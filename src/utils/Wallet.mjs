import SigningClient from '../utils/SigningClient.mjs';

export const messageTypes = [
  '/cosmos.gov.v1beta1.MsgVote',
  '/cosmos.gov.v1beta1.MsgDeposit',
  '/cosmos.gov.v1beta1.MsgSubmitProposal',
  '/cosmos.bank.v1beta1.MsgSend',
  '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
  '/cosmos.staking.v1beta1.MsgDelegate',
  '/cosmos.staking.v1beta1.MsgUndelegate',
  '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  '/cosmos.authz.v1beta1.MsgGrant',
  '/cosmos.authz.v1beta1.MsgRevoke',
  'Custom'
]

class Wallet {
  constructor(network, signerProvider){
    this.network = network
    this.signerProvider = signerProvider
    this.signingClient = new SigningClient(network, signerProvider)
    this.grants = []
  }

  async connect(){
    this.key = await this.signerProvider.connect(this.network)
    this.address = await this.signerProvider.getAddress()
    this.name = this.key?.name
    return this.key
  }

  disconnect(){
    this.signerProvider.disconnect()
  }

  signAndBroadcast(messages, gas, memo, gasPrice){
    return this.signingClient.signAndBroadcast(this.address, messages, gas, memo, gasPrice)
  }

  signAndBroadcastWithoutBalanceCheck(msgs, gas, memo, gasPrice){
    return this.signingClient.signAndBroadcastWithoutBalanceCheck(this.address, msgs, gas, memo, gasPrice)
  }

  simulate(messages, memo, modifier){
    return this.signingClient.simulate(this.address, messages, memo, modifier)
  }

  getFee(gas, gasPrice){
    return this.signingClient.getFee(gas, gasPrice)
  }

  hasPermission(address, action){
    if(address === this.address) return true
    if(!this.authzSupport()) return false

    let message = messageTypes.find(el => {
      return el.split('.').slice(-1)[0].replace('Msg', '') === action
    })
    message = message || action
    return this.grants.some(grant => {
      return grant.granter === address &&
        (!grant.expiration || Date.parse(grant.expiration) > Date.now()) &&
        grant.authorization["@type"] === "/cosmos.authz.v1beta1.GenericAuthorization" &&
        grant.authorization.msg === message
    })
  }

  authzSupport(){
    if(this.signDirectSupport()) return true
    if(this.network.authzAminoLiftedValues && !this.signerProvider.authzAminoLiftedValueSupport) return false

    return this.network.authzAminoSupport && this.signAminoSupport()
  }

  signAminoSupportOnly(){
    return !this.signDirectSupport() && this.signAminoSupport()
  }

  signDirectSupport(){
    return this.signerProvider.signDirectSupport()
  }

  signAminoSupport(){
    return this.signerProvider.signAminoSupport()
  }

  isLedger(){
    return this.signerProvider.isLedger()
  }
}

export default Wallet