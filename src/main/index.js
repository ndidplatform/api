import rp from './rp';
import idp from './idp';
import share from './share';

export rp = {
  ...rp,
  ...share
}

export idp = {
  ...idp,
  ...share
}

export default {
  ...rp,
  ...idp,
  ...share
}