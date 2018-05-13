// TODO
describe('Test All APIs', () => {

  describe('Main logic', () => {
    require('./main');
  });

  describe('RP APIs', () => {
    require('./rpApi');
  });

  describe('IDP APIs', () => {
    require('./idpApi');
  });

  describe('AS APIs', () => {
    require('./asApi');
  });

  describe('MSQ', () => {
    require('./mqNode');
    require('./mqIndex');
  })
});