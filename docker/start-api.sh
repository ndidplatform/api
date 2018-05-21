#!/bin/sh

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
if [ -z ${TENDERMINT_PORT} ]; then exit_missing_env TENDERMINT_PORT; fi
if [ -z ${NODE_ID} ]; then exit_missing_env NODE_ID; fi
if [ -z ${ROLE} ]; then exit_missing_env ROLE; fi
if [ -z ${NDID_IP} ]; then exit_missing_env NDID_IP; fi

KEY_PATH=/api/build/devKey/${ROLE}/${NODE_ID}

tendermint_wait_for_sync_complete() {
  echo "Waiting for tendermint at ${TENDERMINT_IP}:${TENDERMINT_PORT} to be ready..."
  while true; do 
    [ ! "$(curl -s http://${TENDERMINT_IP}:${TENDERMINT_PORT}/status | jq -r .result.syncing)" = "false" ] || break  
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

# check return value; 0 = exist, 1 = does not exist
does_node_id_exist() {
  local _NODE_ID=${NODE_ID}
  if [ $# -gt 0 ]; then _NODE_ID=$1; fi

  echo "Checking if node_id=${_NODE_ID} exist..."
  local DATA=$(echo "GetNodePublicKey|{\"node_id\":\"${_NODE_ID}\"}" | base64)
  if [ "$(curl -s http://${TENDERMINT_IP}:${TENDERMINT_PORT}/abci_query?data=\"${DATA}\" | jq -r .result.response.log)" = "success" ]; then
    echo "node_id=${_NODE_ID} exists"
    return 0
  else
    echo "node_id=${_NODE_ID} does not exist"
    return 1
  fi
}

init_ndid() {
  echo "Initializing NDID node..."

  local PUBLIC_KEY=$(tr '\n' '#' < ${KEY_PATH}.pub | sed 's/#/\\n/g')
  local RESULT=$(curl -sX POST http://${NDID_IP}:${SERVER_PORT}/ndid/initNDID \
    -H "Content-Type: application/json" \
    -d "{\"public_key\":\"${PUBLIC_KEY}\"}")

  if [ "${RESULT}" = "true" ]; then
    echo "Initailizing NDID node succeeded"
    return 0
  else
    echo "Initailizing NDID node failed: ${RESULT}"
    return 1
  fi
}

register_node_id() {
  echo "Registering ${NODE_ID} node..."

  local PUBLIC_KEY=$(tr '\n' '#' < ${KEY_PATH}.pub | sed 's/#/\\n/g')
  local RESULT=$(curl -sX POST http://${NDID_IP}:${SERVER_PORT}/ndid/registerNode \
    -H "Content-Type: application/json" \
    -d "{\"public_key\":\"${PUBLIC_KEY}\",\"node_id\":\"${NODE_ID}\",\"role\":\"${ROLE}\"}")

  if [ "${RESULT}" = "true" ]; then
    echo "Registering ${NODE_ID} node succeeded"
    return 0
  else
    echo "Registering ${NODE_ID} node failed: ${RESULT}"
    return 1
  fi
}

set_token_for_node_id() {
  echo "Giving ${AMOUNT} tokens to ${NODE_ID} node..."

  local AMOUNT=$1
  local RESULT=$(curl -sX POST http://${NDID_IP}:${SERVER_PORT}/ndid/addNodeToken \
    -H "Content-Type: application/json" \
    -d "{\"node_id\":\"${NODE_ID}\",\"amount\":${AMOUNT}}")

  if [ "${RESULT}" = "true" ]; then
    echo "Giving ${AMOUNT} tokens to ${NODE_ID} node succeeded"
    return 0
  else
    echo "Giving ${AMOUNT} tokens to ${NODE_ID} node failed"
    return 1
  fi
}

wait_for_ndid_node_to_be_ready() {
  until nc -z ${NDID_IP} ${SERVER_PORT}; do sleep 1; done;
  if [ $# -gt 0 ]; then eval "$@"; fi
}

wait_until_ndid_node_initialized() {
  until does_node_id_exist ndid1; do sleep 1; done;
}

case ${ROLE} in
  ndid)
    tendermint_wait_for_sync_complete
    if [ ! -f ${KEY_PATH} ] || [ ! -f ${KEY_PATH}.pub ] || ! does_node_id_exist; then
      generate_key
      wait_for_ndid_node_to_be_ready init_ndid &
    fi
    ;;
  idp|rp|as)
    tendermint_wait_for_sync_complete
    
    if [ ! -f ${KEY_PATH} ] || [ ! -f ${KEY_PATH}.pub ] || ! does_node_id_exist; then
      generate_key
      wait_until_ndid_node_initialized
      register_node_id && \
      set_token_for_node_id 10000 
    fi
    ;;
  *) 
    exit_invalid_role 
    ;;
esac

PRIVATE_KEY_PATH=${KEY_PATH} node /api/build/server.js