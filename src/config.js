export const serverPort = process.env.SERVER_PORT || 8080;
export const isIdp = (process.env.IDP === 'true');
export const msqRegister = {
  ip: process.env.IDP_IP,
  port: process.env.IDP_PORT
}