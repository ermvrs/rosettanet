/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  EVMDecodeError,
  EVMDecodeResult,
  RosettanetSignature,
  RPCError,
  RPCRequest,
  RPCResponse,
  StarknetFunction,
} from '../../types/types'
import { Transaction } from 'ethers'
import {
  AccountDeployError,
  AccountDeployResult,
  deployRosettanetAccount,
  getRosettaAccountAddress,
  isRosettaAccountDeployed,
  RosettanetAccountResult,
} from '../../utils/rosettanet'
import { convertHexIntoBytesArray } from '../../utils/felt'
import { callStarknet } from '../../utils/callHelper'
import { validateRawTransaction } from '../../utils/validations'
import { getSnAddressFromEthAddress } from '../../utils/wrapper'
import {
  CairoNamedConvertableType,
  generateEthereumFunctionSignatureFromTypeMapping,
  getContractsAbi,
  getContractsMethods,
  getEthereumInputsCairoNamed,
  getEthereumInputTypesFromStarknetFunction,
} from '../../utils/starknet'
import {
  ConvertableType,
  initializeStarknetAbi,
} from '../../utils/converters/abiFormatter'
import {
  findStarknetFunctionWithEthereumSelector,
  matchStarknetFunctionWithEthereumSelector,
} from '../../utils/match'
import {
  decodeEVMCalldata,
  decodeCalldataWithTypes,
  getFunctionSelectorFromCalldata,
} from '../../utils/calldata'
import {
  prepareRosettanetCalldata,
  prepareSignature,
  prepareStarknetInvokeTransaction,
} from '../../utils/transaction'
import { Uint256ToU256 } from '../../utils/converters/integer'
import { StarknetInvokeTransaction } from '../../types/transactions.types'
import { getDirectivesForStarknetFunction } from '../../utils/directives'
import { isAccountDeployError, isEVMDecodeError, isRPCError } from '../../types/typeGuards'
import { createRosettanetSignature } from '../../utils/signature'
export async function sendRawTransactionHandler(
  request: RPCRequest,
): Promise<RPCResponse | RPCError> {
  if (request.params.length != 1) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument, Parameter should length 1.',
      },
    }
  }

  if (typeof request.params[0] !== 'string') {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument type, parameter should be string.',
      },
    }
  }

  const signedRawTransaction: string = request.params[0]

  const tx = Transaction.from(signedRawTransaction)

  // TODO: chainId check
  const { from, to, data, value, nonce, chainId, signature } = tx

  if (typeof to !== 'string') {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Init transactions are not supported at the moment.',
      },
    }
  }

  if (typeof from !== 'string') {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid from argument type.',
      },
    }
  }

  if (typeof signature === 'undefined' || signature === null) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Transaction is not signed',
      },
    }
  }

  const deployedAccountAddress: RosettanetAccountResult = await getRosettaAccountAddress(from)
  if (!deployedAccountAddress.isDeployed) {
    // This means account is not registered on rosettanet registry. Lets deploy the address
    const accountDeployResult: AccountDeployResult | AccountDeployError = await deployRosettanetAccount(from)
    if(isAccountDeployError(accountDeployResult)) {
      return {
        jsonrpc: request.jsonrpc,
        id: request.id,
        error: {
          code: accountDeployResult.code,
          message: 'Error at account deployment : ' + accountDeployResult.message,
        },
      }
    }

    // eslint-disable-next-line no-console
    console.log(`Account Deployed ${accountDeployResult.contractAddress}`)
  }

  const senderAddress = deployedAccountAddress.contractAddress;

  const isTxValid = validateRawTransaction(tx)
  if (!isTxValid) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32603,
        message: 'Transaction validation error',
      },
    }
  }

  const targetContract: string | RPCError = await getSnAddressFromEthAddress(to)
  if(isRPCError(targetContract)) {
    return targetContract
  }

  if (targetContract === '0x0') {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32000,
        message: 'Invalid argument, Target ethereum address not registered on Rosettanet registry.',
      },
    }
  }

  const contractAbi = await getContractsAbi(targetContract) // Todo: Optimize this get methods, one call enough, methods and custom structs can be derived from abi.

  const contractTypeMapping: Map<string, ConvertableType> =
    initializeStarknetAbi(contractAbi)

  const starknetCallableMethods: Array<StarknetFunction> =
    await getContractsMethods(targetContract)

  const starknetFunctionsEthereumSignatures = starknetCallableMethods.map(fn =>
    generateEthereumFunctionSignatureFromTypeMapping(fn, contractTypeMapping),
  )


  const targetFunctionSelector = getFunctionSelectorFromCalldata(tx.data) // Todo: check if zero

  const targetStarknetFunctionSelector =
    matchStarknetFunctionWithEthereumSelector(
      starknetFunctionsEthereumSignatures,
      targetFunctionSelector,
    )

  const targetStarknetFunction: StarknetFunction | undefined = findStarknetFunctionWithEthereumSelector(
    starknetCallableMethods,
    targetFunctionSelector,
    contractTypeMapping,
  )

  if (
    typeof targetStarknetFunction === 'undefined' ||
    typeof targetStarknetFunctionSelector === 'undefined'
  ) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid argument, Target Starknet Function is not found.',
      },
    }
  }


  const starknetFunctionEthereumInputTypes: Array<CairoNamedConvertableType> =
    getEthereumInputsCairoNamed(targetStarknetFunction, contractTypeMapping)

  const calldata = tx.data.slice(10)
  const EVMCalldataDecode: EVMDecodeResult | EVMDecodeError = decodeEVMCalldata(
    starknetFunctionEthereumInputTypes,
    calldata,
    targetFunctionSelector
  )

  if(isEVMDecodeError(EVMCalldataDecode)) {
    return {
      jsonrpc: request.jsonrpc,
      id: request.id,
      error: {
        code: EVMCalldataDecode.code,
        message: EVMCalldataDecode.message,
      },
    }
  }

  const rosettaSignature: RosettanetSignature = createRosettanetSignature(signature,value)
  /*
pub struct RosettanetCall {
    pub to: EthAddress, // This has to be this account address for multicalls
    pub nonce: u64,
    pub max_priority_fee_per_gas: u128,
    pub max_fee_per_gas: u128,
    pub gas_limit: u64,
    pub value: u256, // To be used future
    pub calldata: Span<felt252>, // Calldata len must be +1 directive len
    pub access_list: Span<AccessListItem>, // TODO: remove this. it always be empty array
    pub directives: Span<u8>, // 0 -> do nothing, 1 -> u256, 2-> address
    pub target_function: Span<felt252> // Function name and types to used to calculate eth func signature
}
  */

  const rosettanetCalldata = prepareRosettanetCalldata(to, nonce.toString(), tx.maxPriorityFeePerGas === null ? '0' : tx.maxPriorityFeePerGas.toString(), tx.maxFeePerGas === null ? '0' : tx.maxFeePerGas.toString(), tx.gasLimit.toString(), value.toString(), EVMCalldataDecode.calldata, EVMCalldataDecode.directives)
  const invokeTransaction: StarknetInvokeTransaction =
    prepareStarknetInvokeTransaction(
      senderAddress,
      rosettanetCalldata,
      rosettaSignature.arrayified,
      chainId.toString(),
      nonce.toString(),
    )
  console.log(JSON.stringify(tx))
  /*const response: RPCResponse | RPCError = await callStarknet(<RPCRequest>{
    jsonrpc: request.jsonrpc,
    id: request.id,
    params: invokeTransaction,
    method: 'starknet_addInvokeTransaction'
  });*/

  console.log(invokeTransaction)
  return {
    jsonrpc: request.jsonrpc,
    id: request.id,
    result: 'todo',
  }
}
