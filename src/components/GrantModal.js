import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import moment from 'moment'

import {
  Modal,
  Button,
  Form,
  Collapse
} from 'react-bootstrap'

import AlertMessage from './AlertMessage';
import { messageTypes } from '../utils/Wallet.mjs';
import { execableMessage, truncateAddress } from '../utils/Helpers.mjs';
import { MsgGrant } from '../messages/MsgGrant.mjs';
import { GenericAuthorization } from '../messages/authorizations/GenericAuthorization.mjs';

function GrantModal(props) {
  const { show, network, address, wallet } = props
  const walletAuthzSupport = wallet?.authzSupport()
  const defaultExpiry = moment().add(1, 'year')
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState()
  const [state, setState] = useState({ maxTokensValue: '', expiryDateValue: defaultExpiry.format('YYYY-MM-DD') });
  const [showLedger, setShowLedger] = useState(!walletAuthzSupport)

  const { daemon_name, chain_id } = network.chain

  useEffect(() => {
    setState({
      ...state,
      granteeValue: '',
      customGranteeValue: '',
      expiryDateValue: defaultExpiry.format('YYYY-MM-DD'),
      grantTypeValue: '/cosmos.authz.v1beta1.GenericAuthorization',
      messageTypeValue: messageTypes[0],
      customMessageTypeValue: '',
    })
    setShowLedger(!walletAuthzSupport)
    setError(null)
  }, [address])

  function handleInputChange(e) {
    setState({ ...state, [e.target.name]: e.target.value });
  }

  function showLoading(isLoading) {
    setLoading(isLoading)
    props.setLoading && props.setLoading(isLoading)
  }

  function messageType(){
    return state.messageTypeValue === 'Custom' ? state.customMessageTypeValue : state.messageTypeValue
  }

  function handleSubmit(event) {
    event.preventDefault()
    if(!address || !walletAuthzSupport || !valid()) return

    showLoading(true)
    setError(null)
    const expiry = moment(state.expiryDateValue)
    let authorization

    switch(state.grantTypeValue){
      case '/cosmos.authz.v1beta1.GenericAuthorization':
        authorization = new GenericAuthorization({
          msg: messageType()
        })
        break
    }

    const message = new MsgGrant({
      granter: address,
      grantee: grantee(),
      grant: {
        authorization: authorization,
        expiration: expiry.unix()
      }
    })

    wallet.signAndBroadcast(execableMessage(message, wallet.address, address)).then((result) => {
      console.log("Successfully broadcasted:", result);
      showLoading(false)
      props.onGrant(grantee(), {
        grantee: grantee(),
        granter: address,
        expiration: expiry,
        authorization: {
          '@type': state.grantTypeValue,
          msg: messageType()
        }
      });
    }, (error) => {
      console.log('Failed to broadcast:', error)
      showLoading(false)
      setError('Failed to broadcast: ' + error.message)
    })
  }

  function handleClose() {
    setError(null)
    props.onHide();
  }

  function grantee(){
    return state.granteeValue === 'custom' ? state.customGranteeValue : state.granteeValue
  }

  function valid(){
    return state.granteeValue && validGrantee() && !!messageType() && wallet?.hasPermission(address, 'Grant')
  }

  function validGrantee(){
    const value = grantee()
    if(!value) return true;

    return !network.prefix || value.startsWith(network.prefix)
  }

  function favourites(){
    return props.favouriteAddresses.filter(el => el.address !== props.address)
  }

  return (
    <>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title className="text-truncate pe-4">
          {address && !!walletAuthzSupport ? 'New Grant' : 'CLI/Ledger instructions'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error &&
            <AlertMessage variant="danger" className="text-break small">
              {error}
            </AlertMessage>
          }
          {!address || !walletAuthzSupport && (
            <>
              <p>Enter your grant details to generate the relevant CLI command.</p>
            </>
          )}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Grantee</Form.Label>
              <select className="form-select" name="granteeValue" aria-label="Grantee" value={state.granteeValue} onChange={handleInputChange}>
                <option value='' disabled>Choose address</option>
                {favourites().length > 0 && (
                  <optgroup label="Favourites">
                    {favourites().map(({ label, address }) => {
                      if (props.address === address) return null

                      return (
                        <option key={address} value={address}>{label || truncateAddress(address)}</option>
                      )
                    })}
                  </optgroup>
                )}
                <option value='custom'>Custom</option>
              </select>
              {state.granteeValue === 'custom' && (
                <Form.Control placeholder={`${network.prefix}1...`} className="mt-1" type="text" name='customGranteeValue' required={true} value={state.customGranteeValue} isInvalid={!validGrantee()} onChange={handleInputChange} />
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Expiry date</Form.Label>
              <Form.Control type="date" name='expiryDateValue' min={moment().format('YYYY-MM-DD')} required={true} value={state.expiryDateValue} onChange={handleInputChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Grant type</Form.Label>
              <select className="form-select" name="grantTypeValue" aria-label="Grant type" value={state.grantTypeValue} onChange={handleInputChange}>
                <option value="/cosmos.authz.v1beta1.GenericAuthorization">GenericAuthorization</option>
              </select>
            </Form.Group>
            {state.grantTypeValue === '/cosmos.authz.v1beta1.GenericAuthorization' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Message type</Form.Label>
                  <select className="form-select" name="messageTypeValue" aria-label="Message type" value={state.messageTypeValue} onChange={handleInputChange}>
                    {messageTypes.map(type => {
                      return (
                        <option key={type} value={type}>{_.startCase(type.split('.').slice(-1)[0].replace('Msg', ''))}</option>
                      )
                    })}
                  </select>
                </Form.Group>
                {state.messageTypeValue === 'Custom' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Type URL</Form.Label>
                    <Form.Control type="text" name='customMessageTypeValue' required={true} value={state.customMessageTypeValue} onChange={handleInputChange} />
                  </Form.Group>
                )}
              </>
            )}
            <p><strong>Incorrect use of Authz grants can be as dangerous as giving away your mnemonic.</strong> Make sure you trust the Grantee address and understand the permissions you are granting.</p>
            {address && !!walletAuthzSupport && (
              <p className="text-end">
                <Button
                  variant="link"
                  onClick={() => setShowLedger(!showLedger)}
                  aria-controls="example-collapse-text"
                  aria-expanded={showLedger}
                >CLI command</Button>
                {!loading
                  ? (
                    <Button type="submit" className="btn btn-primary ms-2" disabled={!valid()}>Create grant</Button>
                  )
                  : <Button className="btn btn-primary" type="button" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                  </Button>
                }
              </p>
            )}
            <Collapse in={showLedger}>
              <pre className="text-wrap"><code>
                <p>{daemon_name ? daemon_name : <kbd>{'<chaind>'}</kbd>} tx authz grant \<br />
                  <kbd>{grantee() || '<grantee>'}</kbd> generic \<br />
                  --msg-type <kbd>{messageType()}</kbd> \<br />
                  --expiration <kbd>{moment(state.expiryDateValue).unix()}</kbd> \<br />
                  --chain-id {chain_id} \<br />
                  --node https://rpc.cosmos.directory:443/{network.name} \<br />
                  --gas auto --gas-prices {network.gasPrice} \<br />
                  --gas-adjustment 1.5 \<br />
                  --from <kbd>my-key</kbd></p>
              </code></pre>
            </Collapse>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default GrantModal
