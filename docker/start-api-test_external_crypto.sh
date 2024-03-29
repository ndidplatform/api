#!/bin/sh

# Install jq and curl as they are required by this script
if ! which jq || ! which curl; then
  sed -i -e 's/http:/https:/' /etc/apk/repositories
  mkdir -p /var/cache/apk
  apk update
  apk add --no-cache curl jq
  rm -rf /var/cache/apk
fi

TENDERMINT_PORT=${TENDERMINT_PORT:-45000}
MQ_BINDING_PORT=${MQ_BINDING_PORT:-5555}
SERVER_PORT=${SERVER_PORT:-8080}

if [ ${HTTPS:-false} = "true" ]; then
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

if [ -z ${NDID_PORT} ]; then NDID_PORT=${SERVER_PORT}; fi

KEY_PATH=${PRIVATE_KEY_PATH:-/api/main-server/dev_key/keys/${NODE_ID}}
MASTER_KEY_PATH=${MASTER_PRIVATE_KEY_PATH:-/api/main-server/dev_key/master_keys/${NODE_ID}_master}
PUBLIC_KEY_PATH=${PUBLIC_KEY_PATH:-/api/main-server/dev_key/keys/${NODE_ID}.pub}
MASTER_PUBLIC_KEY_PATH=${MASTER_PUBLIC_KEY_PATH:-/api/main-server/dev_key/master_keys/${NODE_ID}_master.pub}

NODE_BEHIND_PROXY_PUBLIC_KEY_PATH=${NODE_BEHIND_PROXY_PUBLIC_KEY_PATH:-/api/main-server/dev_key/behind_proxy/keys/}
NODE_BEHIND_PROXY_MASTER_PUBLIC_KEY_PATH=${NODE_BEHIND_PROXY_MASTER_PUBLIC_KEY_PATH:-/api/main-server/dev_key/behind_proxy/master_keys/}

tendermint_wait_for_sync_complete() {
  echo "Waiting for tendermint at ${TENDERMINT_IP}:${TENDERMINT_PORT} to be ready..."
  while true; do 
    [ ! "$(curl -s http://${TENDERMINT_IP}:${TENDERMINT_PORT}/status | jq -r .result.sync_info.catching_up)" = "false" ] || break
    sleep 1
  done
}

generate_key() {
  mkdir -p $(dirname ${KEY_PATH}) && \
  openssl genrsa -out ${KEY_PATH} 2048 && \
  openssl rsa -in ${KEY_PATH} -pubout -out ${PUBLIC_KEY_PATH}

  if [ $? -eq 0 ]; then
    echo "Keypair is generated at ${KEY_PATH} and ${PUBLIC_KEY_PATH}"
    return 0
  else
    echo "Failed to generate keypair at ${KEY_PATH} and ${PUBLIC_KEY_PATH}"
    return 1
  fi
}

generate_master_key() {
  mkdir -p $(dirname ${MASTER_KEY_PATH}) && \
  openssl genrsa -out ${MASTER_KEY_PATH} 2048 && \
  openssl rsa -in ${MASTER_KEY_PATH} -pubout -out ${MASTER_PUBLIC_KEY_PATH}

  if [ $? -eq 0 ]; then
    echo "Keypair is generated at ${MASTER_KEY_PATH} and ${MASTER_PUBLIC_KEY_PATH}"
    return 0
  else
    echo "Failed to generate keypair at ${MASTER_KEY_PATH} and ${MASTER_PUBLIC_KEY_PATH}"
    return 1
  fi
}

# check return value; 0 = exist, 1 = does not exist
does_node_id_exist() {
  local _NODE_ID=${NODE_ID}
  if [ $# -gt 0 ]; then _NODE_ID=$1; fi

  echo "Checking if node_id=${_NODE_ID} exist..."
  local PARAMS="{\"node_id\":\"${_NODE_ID}\"}"
  local DATA=$(printf "\x0a\x10GetNodePublicKey\x12\x$(printf %x ${#PARAMS})${PARAMS}" | xxd -p -c 1000)
  if [ "$(curl -s http://${TENDERMINT_IP}:${TENDERMINT_PORT}/abci_query?data=0x${DATA} | jq -r .result.response.value | base64 -d | jq -r .public_key)" = "" ]; then
    echo "node_id=${_NODE_ID} does not exist"
    return 1
  else
    echo "node_id=${_NODE_ID} exists"
    return 0
  fi
}

init_ndid() {
  echo "Initializing NDID node..."

  local PUBLIC_KEY=$(tr '\n' '#' < ${PUBLIC_KEY_PATH} | sed 's/#/\\n/g')
  local MASTER_PUBLIC_KEY=$(tr '\n' '#' < ${MASTER_PUBLIC_KEY_PATH} | sed 's/#/\\n/g')
  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/init_ndid \
    -H "Content-Type: application/json" \
    -d "{\"public_key\":\"${PUBLIC_KEY}\",\"master_public_key\":\"${MASTER_PUBLIC_KEY}\"}" \
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

end_init() {
  echo "Finishing Initialization..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/end_init \
    -H "Content-Type: application/json" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "204" ]; then
    echo "Finishing Initialization succeeded"
    return 0
  else
    echo "Finishing Initialization failed: ${RESPONSE_CODE}"
    return 1
  fi
}

register_node_id() {
  echo "Registering ${NODE_ID} node..."
  
  local PUBLIC_KEY=$(tr '\n' '#' < ${PUBLIC_KEY_PATH} | sed 's/#/\\n/g')
  local MASTER_PUBLIC_KEY=$(tr '\n' '#' < ${MASTER_PUBLIC_KEY_PATH} | sed 's/#/\\n/g')
  local NODE_NAME=${NODE_NAME:-"This is name: ${NODE_ID}"}
  local REQUEST_BODY
  if [ "${ROLE}" = "idp" ]; then
    REQUEST_BODY="{\"node_key\":\"${PUBLIC_KEY}\",\"node_master_key\":\"${MASTER_PUBLIC_KEY}\",\"node_id\":\"${NODE_ID}\",\"node_name\":\"${NODE_NAME}\",\"role\":\"${ROLE}\",\"max_ial\":${MAX_IAL:-3},\"max_aal\":${MAX_AAL:-3},\"on_the_fly_support\":${ON_THE_FLY_SUPPORT:-true}}"
  else
    REQUEST_BODY="{\"node_key\":\"${PUBLIC_KEY}\",\"node_master_key\":\"${MASTER_PUBLIC_KEY}\",\"node_id\":\"${NODE_ID}\",\"node_name\":\"${NODE_NAME}\",\"role\":\"${ROLE}\"}"
  fi

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/register_node \
    -H "Content-Type: application/json" \
    -d "${REQUEST_BODY}" \
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

register_node_id_behind_proxy() {
  local NODE_ID=$1
  local ROLE=$2
  echo "Registering ${NODE_ID} node..."
  
  local PUBLIC_KEY=$(tr '\n' '#' < ${NODE_BEHIND_PROXY_PUBLIC_KEY_PATH}${NODE_ID}.pub | sed 's/#/\\n/g')
  local MASTER_PUBLIC_KEY=$(tr '\n' '#' < ${NODE_BEHIND_PROXY_MASTER_PUBLIC_KEY_PATH}${NODE_ID}_master.pub | sed 's/#/\\n/g')
  local NODE_NAME=${NODE_NAME:-"This is name: ${NODE_ID}"}
  local REQUEST_BODY
  if [ "${ROLE}" = "idp" ]; then
    REQUEST_BODY="{\"node_key\":\"${PUBLIC_KEY}\",\"node_master_key\":\"${MASTER_PUBLIC_KEY}\",\"node_id\":\"${NODE_ID}\",\"node_name\":\"${NODE_NAME}\",\"role\":\"${ROLE}\",\"max_ial\":${MAX_IAL:-3},\"max_aal\":${MAX_AAL:-3},\"on_the_fly_support\":${ON_THE_FLY_SUPPORT:-true}}"
  else
    REQUEST_BODY="{\"node_key\":\"${PUBLIC_KEY}\",\"node_master_key\":\"${MASTER_PUBLIC_KEY}\",\"node_id\":\"${NODE_ID}\",\"node_name\":\"${NODE_NAME}\",\"role\":\"${ROLE}\"}"
  fi

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/register_node \
    -H "Content-Type: application/json" \
    -d "${REQUEST_BODY}" \
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

add_node_to_proxy_node() {
  local NODE_ID=$1
  local PROXY_NODE_ID=$2
  echo "Add ${NODE_ID} node to proxy ${PROXY_NODE_ID} node..."

  local REQUEST_BODY
  REQUEST_BODY="{\"node_id\":\"${NODE_ID}\",\"proxy_node_id\":\"${PROXY_NODE_ID}\",\"config\":\"KEY_ON_PROXY\"}"
  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/add_node_to_proxy_node \
    -H "Content-Type: application/json" \
    -d "${REQUEST_BODY}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "204" ]; then
    echo "Add ${NODE_ID} node to proxy ${PROXY_NODE_ID} node succeeded"
    return 0
  else
    echo "Add ${NODE_ID} node to proxy ${PROXY_NODE_ID} node failed: ${RESPONSE_CODE}"
    return 1
  fi
}

set_token_for_node_id() {
  local AMOUNT=$1
  echo "Giving ${AMOUNT} tokens to ${NODE_ID} node..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/add_node_token \
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

set_token_for_node_id_behind_proxy() {
  local NODE_ID=$1
  local AMOUNT=$2
  echo "Giving ${AMOUNT} tokens to ${NODE_ID} node..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/add_node_token \
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

has_token_with_amount() {
  local AMOUNT=$1

  echo "Checking if node_id=${NODE_ID} has token with amount=${AMOUNT}..."
  if [ "$(curl -sk ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/utility/nodes/${NODE_ID}/token | jq -r .amount)" = ${AMOUNT} ]; then
    echo "node_id=${NODE_ID} has token with amount=${AMOUNT}"
    return 0
  else
    echo "node_id=${NODE_ID} does not have token with amount=${AMOUNT}"
    return 1
  fi
}

register_namespace() {
  local NAMESPACE=$1
  local DESCRIPTION=$2
  echo "Registering namespace ${NAMESPACE} (${DESCRIPTION}) node..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/create_namespace \
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

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/create_service \
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

approve_service() {
  local SERVICE_ID=$1
  echo "Approving service ${SERVICE_ID} for node ${NODE_ID}..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/approve_service \
    -H "Content-Type: application/json" \
    -d "{\"service_id\":\"${SERVICE_ID}\",\"node_id\":\"${NODE_ID}\"}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "204" ]; then
    echo "Approving service ${SERVICE_ID} for node ${NODE_ID} succeeded"
    return 0
  else
    echo "Approving service ${SERVICE_ID} for node ${NODE_ID} failed: ${RESPONSE_CODE}"
    return 1
  fi
}

approve_service_node_behind_proxy() {
  local SERVICE_ID=$1
  local NODE_ID=$2
  echo "Approving service ${SERVICE_ID} for node ${NODE_ID}..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/approve_service \
    -H "Content-Type: application/json" \
    -d "{\"service_id\":\"${SERVICE_ID}\",\"node_id\":\"${NODE_ID}\"}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "204" ]; then
    echo "Approving service ${SERVICE_ID} for node ${NODE_ID} succeeded"
    return 0
  else
    echo "Approving service ${SERVICE_ID} for node ${NODE_ID} failed: ${RESPONSE_CODE}"
    return 1
  fi
}

did_namespace_exist() {
  local NAMESPACE=$1

  echo "Checking if namespace=${NAMESPACE} exist..."
  if [ "$(curl -sk ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/utility/namespaces | jq -r .[].namespace | grep -E ^${NAMESPACE}$)" = "" ]; then
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
  if [ "$(curl -sk ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/utility/services | jq -r .[].service_id | grep -E ^${SERVICE_ID}$)" = "" ]; then
    echo "service_id=${SERVICE_ID} does not exist"
    return 1
  else
    echo "service_id=${SERVICE_ID} exists"
    return 0
  fi
}

tendermint_add_validator() {
  echo "Getting tendermint public key..."

  until local PUBKEY=$(curl -s http://${TENDERMINT_IP}:${TENDERMINT_PORT}/status | jq -r .result.validator_info.pub_key.value)
  do
    sleep 1
  done

  echo "Tendermint public key is ${PUBKEY}"

  echo "Adding node as a validator..."

  local RESPONSE_CODE=$(curl -skX POST ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/ndid/set_validator \
    -H "Content-Type: application/json" \
    -d "{\"public_key\":\"${PUBKEY}\",\"power\":10}" \
    -w '%{http_code}' \
    -o /dev/null)

  if [ "${RESPONSE_CODE}" = "204" ]; then
    echo "Adding node as a validator succeeded"
    return 0
  else
    echo "Adding node as a validator failed: ${RESPONSE_CODE}"
    return 1
  fi
}

wait_for_ndid_node_to_be_ready() {
  while [ "$(curl -sk ${PROTOCOL}://${NDID_IP}:${NDID_PORT}/info | jq -r .error.code)" = "10008" ]; do sleep 1; done;
  if [ $# -gt 0 ]; then eval "$@"; fi
}

wait_until_ndid_node_initialized() {
  until does_node_id_exist ndid1; do sleep 1; done;
}

wait_until_node_exist() {
  until does_node_id_exist ${NODE_ID}; do sleep 1; done;
}

wait_until_node_has_token_with_amount() {
  until has_token_with_amount $1; do sleep 1; done;
}

wait_until_namespace_exist() {
  until did_namespace_exist $1; do sleep 1; done;
}

wait_until_service_exist() {
  until did_service_exist $1; do sleep 1; done;
}

register_nodes_behind_proxy(){
  if [ "${NODE_ID}" = "proxy1" ]; then
    until register_node_id_behind_proxy "proxy1_rp4" "rp"; do sleep 1; done
    until register_node_id_behind_proxy "proxy1_idp4" "idp"; do sleep 1; done
    until register_node_id_behind_proxy "proxy1_as4" "as"; do sleep 1; done
    until set_token_for_node_id_behind_proxy "proxy1_rp4" 10000; do sleep 1; done
    until set_token_for_node_id_behind_proxy "proxy1_idp4" 10000; do sleep 1; done
    until set_token_for_node_id_behind_proxy "proxy1_as4" 10000; do sleep 1; done
    until add_node_to_proxy_node "proxy1_rp4" ${NODE_ID}; do sleep 1; done
    until add_node_to_proxy_node "proxy1_idp4" ${NODE_ID}; do sleep 1; done
    until add_node_to_proxy_node "proxy1_as4" ${NODE_ID}; do sleep 1; done
    until approve_service_node_behind_proxy "bank_statement" "proxy1_as4"; do sleep 1; done
    until approve_service_node_behind_proxy "customer_info" "proxy1_as4"; do sleep 1; done
  elif [ "${NODE_ID}" = "proxy2" ]; then
    until register_node_id_behind_proxy "proxy2_rp5" "rp"; do sleep 1; done
    until register_node_id_behind_proxy "proxy2_idp5" "idp"; do sleep 1; done
    until register_node_id_behind_proxy "proxy2_as5" "as"; do sleep 1; done
    until set_token_for_node_id_behind_proxy "proxy2_rp5" 10000; do sleep 1; done
    until set_token_for_node_id_behind_proxy "proxy2_idp5" 10000; do sleep 1; done
    until set_token_for_node_id_behind_proxy "proxy2_as5" 10000; do sleep 1; done
    until add_node_to_proxy_node "proxy2_rp5" ${NODE_ID}; do sleep 1; done
    until add_node_to_proxy_node "proxy2_idp5" ${NODE_ID}; do sleep 1; done
    until add_node_to_proxy_node "proxy2_as5" ${NODE_ID}; do sleep 1; done
    until approve_service_node_behind_proxy "bank_statement" "proxy1_as4"; do sleep 1; done
    until approve_service_node_behind_proxy "customer_info" "proxy1_as4"; do sleep 1; done
  fi
}

case ${ROLE} in
  ndid)
    tendermint_wait_for_sync_complete
    if ! does_node_id_exist; then
      if [ ! "${USE_EXTERNAL_CRYPTO_SERVICE}" = "true" ] && ([ ! -f ${KEY_PATH} ] || [ ! -f ${PUBLIC_KEY_PATH} ]); then
        generate_key
      fi
      if [ ! "${USE_EXTERNAL_CRYPTO_SERVICE}" = "true" ] && ([ ! -f ${MASTER_KEY_PATH} ] || [ ! -f ${MASTER_PUBLIC_KEY_PATH} ]); then
        generate_master_key
      fi
      wait_for_ndid_node_to_be_ready && \
      until init_ndid; do sleep 1; done && \
      until end_init; do sleep 1; done && \
      until 
        register_namespace "citizen_id" "Thai citizen ID" && \
        register_namespace "passport_num" "Passport Number" && \
        register_service "bank_statement" "All transactions in the past 3 months" && \
        register_service "customer_info" "Customer Information"
      do
        sleep 1; 
      done &
    fi
    ;;
  idp|rp|as|proxy)
    tendermint_wait_for_sync_complete
    
    if ! does_node_id_exist; then
      if [ ! "${USE_EXTERNAL_CRYPTO_SERVICE}" = "true" ] && ([ ! -f ${KEY_PATH} ] || [ ! -f ${PUBLIC_KEY_PATH} ]); then
        generate_key
      fi
      if [ ! "${USE_EXTERNAL_CRYPTO_SERVICE}" = "true" ] && ([ ! -f ${MASTER_KEY_PATH} ] || [ ! -f ${MASTER_PUBLIC_KEY_PATH} ]); then
        generate_master_key
      fi
      wait_until_ndid_node_initialized
      wait_until_namespace_exist "citizen_id"
      wait_until_namespace_exist "passport_num"
      wait_until_service_exist "bank_statement"
      wait_until_service_exist "customer_info"
      until register_node_id; do sleep 1; done
      wait_until_node_exist
      until set_token_for_node_id 10000; do sleep 1; done
      wait_until_node_has_token_with_amount 10000
      until tendermint_add_validator; do sleep 1; done
      if [ "${ROLE}" = "as" ]; then
        until approve_service "bank_statement"; do sleep 1; done
        until approve_service "customer_info"; do sleep 1; done
      fi
      if [ "${ROLE}" = "proxy" ]; then
        register_nodes_behind_proxy
      fi

      sleep 3
    fi
    ;;
  *) 
    exit_invalid_role 
    ;;
esac

export PRIVATE_KEY_PATH=${KEY_PATH} 
export MASTER_PRIVATE_KEY_PATH=${MASTER_KEY_PATH} 
node /api/main-server/build/server.js