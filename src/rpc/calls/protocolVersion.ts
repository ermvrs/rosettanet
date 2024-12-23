import { isRPCError } from '../../types/typeGuards'
import { RPCError, RPCRequest, RPCResponse } from '../../types/types'
import { callStarknet } from '../../utils/callHelper'

export async function protocolVersionHandler(
  request: RPCRequest,
): Promise<RPCResponse | RPCError> {
  if (request.params.length != 0) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument, Parameter field should be empty.',
      },
    }
  }

  const response: RPCResponse | RPCError = await callStarknet({
    jsonrpc: request.jsonrpc,
    method: 'starknet_specVersion',
    params: [],
    id: request.id,
  })

  if(isRPCError(response)) {
    return response
  }

  const result = response.result as string

  const numericString = result.replace(/\./g, '')

  const number = parseInt(numericString, 10)

  const hexNumber = '0x' + number.toString(16)

  return {
    jsonrpc: request.jsonrpc,
    id: request.id,
    result: hexNumber,
  }
}
