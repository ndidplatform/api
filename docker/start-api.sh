#!/bin/sh

TENDERMINT_PORT=${TENDERMINT_PORT:-45000}
MQ_BINDING_PORT=${MQ_BINDING_PORT:-5555}
SERVER_PORT=${SERVER_PORT:-8080}
if [ ${HTTPS:-true} = "true" ]; then
  PROTOCOL=https
else  
  PROTOCOL=http
fi

exit_missing_env() {
  echo "MISSING ENV: ${1} is not set"
  exit 1
}

exit_invalid_role() {
  echo "INVALID ROLE: ROLE must be either ndid|idp|rp|as but got ${ROLE}"
  exit 1
}

exit_path_not_exist() {
  echo "MISSING FILE: ${1} is not found"
  exit 1
}

if [ -z ${SERVER_PORT} ]; then exit_missing_env SERVER_PORT; fi
if [ -z ${TENDERMINT_IP} ]; then exit_missing_env TENDERMINT_IP; fi
if [ -z ${NODE_ID} ]; then exit_missing_env NODE_ID; fi
if [ -z ${ROLE} ]; then exit_missing_env ROLE; fi
if [ -z ${NDID_IP} ]; then exit_missing_env NDID_IP; fi

KEY_PATH=/api/build/devKey/${ROLE}/${NODE_ID}
MASTER_KEY_PATH=/api/build/devKey/${ROLE}/master/${NODE_ID}

tendermint_wait_for_sync_complete() {
  echo "Waiting for tendermint at ${TENDERMINT_IP}:${TENDERMINT_PORT} to be ready..."
  while true; do 
    [ ! "$(curl -s http://${TENDERMINT_IP}:${TENDERMINT_PORT}/status | jq -r .result.sync_info.syncing)" = "false" ] || break  
    sleep 1
  done
}

generate_key() {
  mkdir -p $(dirname ${KEY_PATH}) && \
  openssl genrsa -out ${KEY_PATH} 2048 && \
  openssl rsa -in ${KEY_PATH} -pubout -out ${KEY_PATH}.pub

  if [ $? -eq 0 ]; then
    echo "Keypair is generated at ${KEY_PATH} and ${KEY_PATH}.pub"
    return 0
  else
    echo "Failed to generate keypair at ${KEY_PATH} and ${KEY_PATH}.pub"
    return 1
  fi
}

generate_master_key() {
  mkdir -p $(dirname ${MASTER_KEY_PATH}) && \
  openssl genrsa -out ${MASTER_KEY_PATH} 2048 && \
  openssl rsa -in ${MASTER_KEY_PATH} -pubout -out ${MASTER_KEY_PATH}.pub

  if [ $? -eq 0 ]; then
    echo "Keypair is generated at ${MASTER_KEY_PATH} and ${MASTER_KEY_PATH}.pub"
    return 0
  else
    echo "Failed to generate keypair at ${MASTER_KEY_PATH} and ${MASTER_KEY_PATH}.pub"
    return 1
  fi
}

# check return value; 0 = exist, 1 = does not exist
does_node_id_exist() {
  local _NODE_ID=${NODE_ID}
  if [ $# -gt 0 ]; then _NODE_ID=$1; fi

  echo "Checking if node_id=${_NODE_ID} exist..."
  local DATA=$(echo "GetNodePublicKey|{\"node_id\":\"${_NODE_ID}\"}" | base64 | sed 's/\//%2F/g;s/+/%2B/g')
  if [ "$(curl -sk http://${TENDERMINT_IP}:${TENDERMINT_PORT}/abci_query?data=\"${DATA}\" | jq -r .result.response.value | base64 -d | jq -r .public_key)" = "" ]; then
    echo "node_id=${_NODE_ID} does not exist"
    return 1
  else
    echo "node_id=${_NODE_ID} exists"
    return 0
  fi
}

init_ndid() {
  echo "Initializing NDID node..."

  local PUBLIC_KEY=$(tr '\n' '#' < ${KEY_PATH}.pub | sed 's/#/\\n/g')
  
  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${SERVER_PORT}/ndid/initNDID \
    -H "Content-Type: application/json" \
    -d "{\"public_key\":\"${PUBLIC_KEY}\"}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "204" ]; then
    echo "Initailizing NDID node succeeded"
    return 0
  else
    echo "Initailizing NDID node failed: ${RESPONSE_CODE}"
    return 1
  fi
}

register_node_id() {
  echo "Registering ${NODE_ID} node..."
  
  local PUBLIC_KEY=$(tr '\n' '#' < ${KEY_PATH}.pub | sed 's/#/\\n/g')
  local MASTER_PUBLIC_KEY=$(tr '\n' '#' < ${MASTER_KEY_PATH}.pub | sed 's/#/\\n/g')
  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${SERVER_PORT}/ndid/registerNode \
    -H "Content-Type: application/json" \
    -d "{\"public_key\":\"${PUBLIC_KEY}\",\"master_public_key\":\"${MASTER_PUBLIC_KEY}\",\"node_id\":\"${NODE_ID}\",\"node_name\":\"This is name: ${NODE_ID}\",\"role\":\"${ROLE}\",\"max_ial\":${MAX_IAL:-3},\"max_aal\":${MAX_AAL:-3}}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "201" ]; then
    echo "Registering ${NODE_ID} node succeeded"
    return 0
  else
    echo "Registering ${NODE_ID} node failed: ${RESPONSE_CODE}"
    return 1
  fi
}

set_token_for_node_id() {
  local AMOUNT=$1
  echo "Giving ${AMOUNT} tokens to ${NODE_ID} node..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${SERVER_PORT}/ndid/addNodeToken \
    -H "Content-Type: application/json" \
    -d "{\"node_id\":\"${NODE_ID}\",\"amount\":${AMOUNT}}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "204" ]; then
    echo "Giving ${AMOUNT} tokens to ${NODE_ID} node succeeded"
    return 0
  else
    echo "Giving ${AMOUNT} tokens to ${NODE_ID} node failed: ${RESPONSE_CODE}"
    return 1
  fi
}

register_namespace() {
  local NAMESPACE=$1
  local DESCRIPTION=$2
  echo "Registering namespace ${NAMESPACE} (${DESCRIPTION}) node..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${SERVER_PORT}/ndid/namespaces \
    -H "Content-Type: application/json" \
    -d "{\"namespace\":\"${NAMESPACE}\",\"description\":\"${DESCRIPTION}\"}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "201" ]; then
    echo "Registering namespace ${NAMESPACE} (${DESCRIPTION}) node succeeded"
    return 0
  else
    echo "Registering namespace ${NAMESPACE} (${DESCRIPTION}) node failed: ${RESPONSE_CODE}"
    return 1
  fi
}

register_service() {
  local SERVICE_ID=$1
  local SERVICE_NAME=$2
  echo "Registering service ${SERVICE_ID} (${SERVICE_NAME}) node..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${SERVER_PORT}/ndid/services \
    -H "Content-Type: application/json" \
    -d "{\"service_id\":\"${SERVICE_ID}\",\"service_name\":\"${SERVICE_NAME}\"}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "201" ]; then
    echo "Registering service ${SERVICE_ID} (${SERVICE_NAME}) node succeeded"
    return 0
  else
    echo "Registering service ${SERVICE_ID} (${SERVICE_NAME}) node failed: ${RESPONSE_CODE}"
    return 1
  fi
}

did_namespace_exist() {
  local NAMESPACE=$1

  echo "Checking if namespace=${NAMESPACE} exist..."
  if [ "$(curl -sk ${PROTOCOL}://${NDID_IP}:${SERVER_PORT}/utility/namespaces | jq -r .[].namespace | grep -E ^${NAMESPACE}$)" = "" ]; then
    echo "namespace=${NAMESPACE} does not exist"
    return 1
  else
    echo "namespace=${NAMESPACE} exists"
    return 0
  fi
}

did_service_exist() {
  local SERVICE_ID=$1

  echo "Checking if service_id=${SERVICE_ID} exist..."
  if [ "$(curl -sk ${PROTOCOL}://${NDID_IP}:${SERVER_PORT}/utility/services | jq -r .[].service_id | grep -E ^${SERVICE_ID}$)" = "" ]; then
    echo "service_id=${SERVICE_ID} does not exist"
    return 1
  else
    echo "service_id=${SERVICE_ID} exists"
    return 0
  fi
}

wait_for_ndid_node_to_be_ready() {
  until nc -z ${NDID_IP} ${SERVER_PORT}; do sleep 1; done;
  if [ $# -gt 0 ]; then eval "$@"; fi
}

wait_until_ndid_node_initialized() {
  until does_node_id_exist ndid1; do sleep 1; done;
}

wait_until_namespace_exist() {
  until did_namespace_exist $1; do sleep 1; done;
}

wait_until_service_exist() {
  until did_service_exist $1; do sleep 1; done;
}

case ${ROLE} in
  ndid)
    tendermint_wait_for_sync_complete
    if [ ! -f ${KEY_PATH} ] || [ ! -f ${KEY_PATH}.pub ] || ! does_node_id_exist; then
      generate_key
      wait_for_ndid_node_to_be_ready && \
      init_ndid && \
      register_namespace "cid" "Thai citizen ID" && \
      register_service "bank_statement" "All transactions in the pass 3 month" &
    fi
    ;;
  idp|rp|as)
    tendermint_wait_for_sync_complete
    
    if [ ! -f ${KEY_PATH} ] || [ ! -f ${KEY_PATH}.pub ] || ! does_node_id_exist; then
      generate_key
      generate_master_key
      wait_until_ndid_node_initialized
      wait_until_namespace_exist "cid"
      wait_until_service_exist "bank_statement"
      register_node_id && \
      set_token_for_node_id 10000 
    fi
    ;;
  *) 
    exit_invalid_role 
    ;;
esac

PRIVATE_KEY_PATH=${KEY_PATH} MASTER_PRIVATE_KEY_PATH=${MASTER_KEY_PATH} node /api/build/server.js