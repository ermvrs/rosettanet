/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  isEVMDecodeError,
  isEVMEncodeResult,
  isRPCError,
  isStarknetContract,
  isStarknetRPCError,
} from '../../types/typeGuards'
import {
  EVMDecodeError,
  EVMDecodeResult,
  EVMEncodeError,
  EVMEncodeResult,
  RPCError,
  RPCRequest,
  RPCResponse,
  StarknetContract,
  StarknetContractReadError,
  StarknetRPCError,
} from '../../types/types'
import { callStarknet } from '../../utils/callHelper'
import {
  decodeEVMCalldataWithAddressConversion,
  encodeStarknetData,
  getFunctionSelectorFromCalldata,
} from '../../utils/calldata'
import {
  ConvertableType,
  initializeStarknetAbi,
} from '../../utils/converters/abiFormatter'
import {
  findStarknetCallableMethod,
  StarknetCallableMethod,
} from '../../utils/match'
import { snKeccak } from '../../utils/sn_keccak'
import {
  CairoNamedConvertableType,
  getContractAbiAndMethods,
  getEthereumInputsCairoNamed,
  getEthereumOutputsCairoNamed,
} from '../../utils/starknet'
import { validateEthAddress } from '../../utils/validations'
import { getSnAddressFromEthAddress } from '../../utils/wrapper'

export interface EthCallParameters {
  from?: string
  to: string
  gas?: string | number | bigint
  gasPrice?: string | number | bigint
  value?: string | number | bigint
  data?: string
  input?: string
}

export function isEthCallParameters(
  value: unknown,
): value is EthCallParameters {
  // We can improve these validations
  if (typeof value === 'object' && value !== null) {
    const obj = value as EthCallParameters
    return typeof obj.to === 'string'
  }
  return false
}

export async function ethCallHandler(
  request: RPCRequest,
): Promise<RPCResponse | RPCError> {
  if (Array.isArray(request.params) && request.params.length != 2) {
    return <RPCError>{
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument, Parameter length should be 2.',
      },
    }
  }

  const parameters = request.params[0] // What happens if they pass object or array?? TODO
  if (!isEthCallParameters(parameters)) {
    return <RPCError>{
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument, First parameter must be object',
      },
    }
  }

  if (!validateEthAddress(parameters.to)) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument, "to" field is not valid Ethereum address',
      },
    }
  }

  if (parameters.from && validateEthAddress(parameters.from)) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument, "from" field is not valid Ethereum address',
      },
    }
  }

  const calldata = parameters.input ?? parameters.data ?? null
  const targetFunctionSelector: string | null = getFunctionSelectorFromCalldata(
    calldata,
  )

  if (
    targetFunctionSelector == null ||
    typeof calldata === 'undefined' || calldata == null
  ) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      result: '0x',
    }
  }
  // ETH CALL BAZEN from field bos geliyor.
  // to ise registered degilse result 0x donmeli
  const targetContractAddress: string | StarknetRPCError =
    await getSnAddressFromEthAddress(parameters.to)
  if (isStarknetRPCError(targetContractAddress)) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      result: '0x',
    }
  }

  const targetContract: StarknetContract | StarknetContractReadError =
    await getContractAbiAndMethods(targetContractAddress)
  if (!isStarknetContract(targetContract)) {
    return <RPCError>{
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: targetContract.code,
        message:
          'Error at reading starknet contract abi: ' + targetContract.message,
      },
    }
  }

  const contractTypeMapping: Map<string, ConvertableType> =
    initializeStarknetAbi(targetContract.abi)

  const starknetFunction: StarknetCallableMethod | undefined =
    findStarknetCallableMethod(
      targetFunctionSelector,
      targetContract.methods,
      contractTypeMapping,
    )
  // It tries to find starknet method in target contract without throwin error.
  if (typeof starknetFunction === 'undefined') {
    return <RPCResponse>{
      jsonrpc: request.jsonrpc,
      id: request.id,
      result: '0x',
    }
  }

  const starknetFunctionEthereumInputTypes: Array<CairoNamedConvertableType> =
    getEthereumInputsCairoNamed(
      starknetFunction.snFunction,
      contractTypeMapping,
    )

  const inputs = calldata.slice(10)
  const EVMCalldataDecode: EVMDecodeResult | EVMDecodeError =
    await decodeEVMCalldataWithAddressConversion(
      starknetFunctionEthereumInputTypes,
      inputs,
      targetFunctionSelector,
    )

  if (isEVMDecodeError(EVMCalldataDecode)) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: EVMCalldataDecode.code,
        message: EVMCalldataDecode.message,
      },
    }
  }

  EVMCalldataDecode.calldata.shift() // Remove first item, it is function selector

  const starknetSelector = snKeccak(starknetFunction.name.split('(')[0])
  const starknetCallParams = [
    {
      calldata: EVMCalldataDecode.calldata,
      contract_address: targetContractAddress,
      entry_point_selector: starknetSelector,
    },
    'pending', // update to latest
  ]

  const snResponse: RPCResponse | StarknetRPCError = await callStarknet({
    jsonrpc: request.jsonrpc,
    method: 'starknet_call',
    params: starknetCallParams,
    id: request.id,
  })

  if (isStarknetRPCError(snResponse)) {
    return <RPCError>{
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: snResponse,
    }
  }

  const starknetFunctionEthereumOutputTypes: Array<CairoNamedConvertableType> =
    getEthereumOutputsCairoNamed(
      starknetFunction.snFunction,
      contractTypeMapping,
    )

  const formattedStarknetOutput: EVMEncodeResult | EVMEncodeError =
    encodeStarknetData(starknetFunctionEthereumOutputTypes, snResponse.result)

  if (!isEVMEncodeResult(formattedStarknetOutput)) {
    return <RPCError>{
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32705,
        message: formattedStarknetOutput.message,
      },
    }
  }

  return {
    jsonrpc: request.jsonrpc,
    id: request.id,
    result: formattedStarknetOutput.data,
  }
}
