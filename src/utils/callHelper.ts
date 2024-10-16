import { getRpc } from './getRpc'
import { RPCRequest, RPCResponse } from '../types/types'
import axios from 'axios'

interface EstimateFeeRequest {
  jsonrpc: string
  method: string
  params: {
    request: Array<object>
    block_id: string
    simulation_flags: Array<string>
  }
  id: number
}

interface GetClassHashRequest {
  jsonrpc: string
  method: string
  params: {
    contract_address: string
    block_id: string
  }
  id: number
}

export interface StarknetInvokeParams {
  invoke_transaction: {
    type: string
    sender_address: string
    calldata: Array<string>
    version: string
    signature: Array<string>
    nonce: string
    resource_bounds: {
      l1_gas: string
      l2_gas: string
    }
    tip: string
    paymaster_data: Array<string>
    account_deployment_data: Array<string>
    nonce_data_availability_mode: string
    fee_data_availability_mode: string
  }
}

export async function callStarknet(
  request: RPCRequest | EstimateFeeRequest | GetClassHashRequest,
): Promise<RPCResponse | string> {
  try {
    const rpcUrl: string = getRpc()
    const { data } = await axios.post<RPCResponse>(
      rpcUrl,
      JSON.stringify(request),
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    )
    return data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return error.message
    } else {
      return 'An unexpected error occurred'
    }
  }
}

export function prepareStarknetInvokeParams(
  sender_address: string,
  calldata: Array<string>,
  signature: Array<string>,
  nonce: string,
): StarknetInvokeParams {
  // TODO: fill the l1 gas and l2 gas values here
  return {
    invoke_transaction: {
      type: 'INVOKE',
      sender_address: sender_address,
      calldata: calldata,
      version: '0x3', // TODO: check is okay
      signature: signature,
      nonce: nonce,
      resource_bounds: {
        l1_gas: '0x1', // TODO
        l2_gas: '0x2', // TODO
      },
      tip: '0x0',
      paymaster_data: [],
      account_deployment_data: [],
      nonce_data_availability_mode: 'L1',
      fee_data_availability_mode: 'L1',
    },
  }
}
