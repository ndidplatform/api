export const serverPort = process.env.SERVER_PORT || 8080;
export const role = process.env.ROLE;
export const mqRegister = {
  ip: process.env.MQ_CONTACT_IP,
  port: process.env.MQ_BINDING_PORT || 5555,
};
