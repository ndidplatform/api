# Changelog

## 0.2.1 (July 3, 2018)

BUG FIXES:

- Fix destructure variables error when IdP message queue address is not found.
- Change public encrypt and private decrypt padding scheme. (Default(PKCS#1 OAEP) to PKCS#1 v1.5).
- Add missing value for accessorSign callback (type, padding) and fix sign_method
- [Docker] Fix issue which master public key is empty string when register a new node

## 0.2.0 (June 30, 2018)

BREAKING CHANGES:

- API version 1.1
- POST `/idp/response` is now asynchronous. `callback_url` is required in a request body.

IMPROVEMENTS:

- [CircleCI] Add a configuration for automatic test, build, and deploy image to dockerhub. ([#23](https://github.com/ndidplatform/api/pull/23))
- Configurable callback retry timeout. The config only applies to some callbacks. Can be set with `CALLBACK_RETRY_TIMEOUT` environment variable. Accept number in seconds. ([#25](https://github.com/ndidplatform/api/issues/25))
- Handle error when IdP sending a response to a closed or timed out request. Send back a correct error code/message. ([#29](https://github.com/ndidplatform/api/issues/29))
- [Docker] Improve building efficiency in Dockerfile
- [Docker] Use node keypair and master keypair paths from env PRIVATE_KEY_PATH, MASTER_PRIVATE_KEY_PATH, PUBLIC_KEY_PATH, and MASTER_PRIVATE_KEY_PATH
- [Docker] Improve robustness of docker startup script

BUG FIXES:

- Fix GET `/utility/requests/:request_id` response with error 500 when `request_id` does not exist. ([#19](https://github.com/ndidplatform/api/issues/19))
- Fix creating identity request final status stuck at "pending". ([#20](https://github.com/ndidplatform/api/issues/20))
- Fix GET `/as/service/:service_id` response with a wrong format. ([#21](https://github.com/ndidplatform/api/issues/21))
- Fix a request without data request does not close automatically when its status is "completed". ([#22](https://github.com/ndidplatform/api/issues/22))
- Fix GET `/utility/as/:service_id` does not return status 404 when `service_id` does not exist. ([#24](https://github.com/ndidplatform/api/issues/24))
- Fix IdP queries rp_id to send privateProof and got null. ([#26](https://github.com/ndidplatform/api/issues/26))
- Fix duplicate IdP ID in response_valid_list in request status callback to RP. ([#27](https://github.com/ndidplatform/api/issues/27)) ([#28](https://github.com/ndidplatform/api/issues/28))

## 0.1.0 (June 24, 2018)

Initial release of NDID API
