if (process.env.NODE_ENV == null || process.env.NODE_ENV === '') {
  console.warn(
    '"NODE_ENV" environment variable is not set. Default to "development"'
  );
}

if (process.env.ROLE == null) {
  console.error(
    '"ROLE" environment variable is not set. Process will now exit.'
  );
  process.exit(1);
}

if (
  process.env.ROLE !== 'idp' &&
  process.env.ROLE !== 'rp' &&
  process.env.ROLE !== 'as' &&
  process.env.ROLE !== 'ndid'
) {
  console.error(
    `Unknown role: ${
      process.env.ROLE
    }; Must be one of "idp", "rp", "as", or "ndid". Process will now exit.`
  );
  process.exit(1);
}

if (process.env.TENDERMINT_IP == null) {
  console.warn(
    '"TENDERMINT_IP" environment variable is not set. Default to "localhost"'
  );
}

if (process.env.MQ_CONTACT_IP == null) {
  console.warn(
    '"MQ_CONTACT_IP" environment variable is not set. Default to "localhost"'
  );
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.LOG_DIRECTORY_PATH == null
) {
  console.warn(
    `"LOG_DIRECTORY_PATH" environment variable is not set. Default to "${__dirname}"`
  );
}
