describe('Test All APIs', () => {

  describe('RP APIs', () => {
    require('./rpApi');
  });

  describe('IDP APIs', () => {
    require('./idpApi');
  });

  describe('AS APIs', () => {
    require('./asApi');
  });

});