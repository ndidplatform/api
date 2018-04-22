const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Node = require('./libp2p-bundle')
const pull = require('pull-stream')
const async = require('async')
const Pushable = require('pull-pushable')

const p = Pushable(err => {
    console.log("stream closed");  
})