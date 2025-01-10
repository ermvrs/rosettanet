import BigNumber from "bignumber.js";
import { writeLog } from "../logger";
import { isStarknetRPCError } from "../types/typeGuards";
import { RPCResponse, StarknetRPCError } from "../types/types";
import { callStarknet } from "../utils/callHelper";
import { addHexPrefix } from "../utils/padding";

export interface SyncedL1Gas {
    wei: string,
    fri: string
    data? : {
        wei: string
        fri: string
    }
}

let syncedGasPrice: SyncedL1Gas;

export function getCachedGasPrice(): SyncedL1Gas {
    if(typeof syncedGasPrice === 'undefined') {
        return {
            wei: '0x0',
            fri: '0x0',
            data : {
                wei: '0x0',
                fri: '0x0'
            }
        }
    }
    return syncedGasPrice
}

async function updateGasPrice() {
    try {
        const blockHashCall: RPCResponse | StarknetRPCError = await callStarknet({
            jsonrpc: '2.0',
            method: 'starknet_blockHashAndNumber',
            params: [],
            id: 1,
        })
    
        if(isStarknetRPCError(blockHashCall)) {
            writeLog(2, 'Error at syncing starknet gas price' + blockHashCall.message);
            return;
        }
    
        if(typeof blockHashCall.result.block_hash !== 'string') {
            writeLog(2, 'Block hash and number call returned wrong value' + blockHashCall.result);
            return;
        }
    
        const blockHash: string = blockHashCall.result.block_hash
    
        const blockResponse: RPCResponse | StarknetRPCError = await callStarknet({
            jsonrpc: "2.0",
            method: "starknet_getBlockWithTxs",
            params: {
              block_id: {
                block_hash: blockHash
              }
            },
            id: 0
        })
    
        if(isStarknetRPCError(blockResponse)) {
            writeLog(2, 'Error at starknet_getBlockWithTxs call on gas price sync.');
            return; 
        }
    
        const l1Gas = blockResponse.result.l1_gas_price;
        const l1DataGas = blockResponse.result.l1_data_gas_price;
    
        if(typeof l1Gas !== 'object') {
            writeLog(2, 'L1_gas_price is not object');
            return;
        }
        syncedGasPrice = {
            wei: l1Gas.price_in_wei,
            fri: addHexPrefix((BigInt(l1Gas.price_in_fri) + (BigInt(l1Gas.price_in_fri) / BigInt(10))).toString(16)),
            data : {
                wei: l1DataGas?.price_in_wei,
                fri: l1DataGas?.price_in_fri
            }
        }
        writeLog(1, 'Gas Synced: ' + syncedGasPrice.fri)
        return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch(e: any) {
        writeLog(2, 'Error at gas sync: ' + e.message)
    }

}

export async function syncGasPrice() {
    // eslint-disable-next-line no-constant-condition
    while(true) {
        await updateGasPrice();
        await new Promise<void>((resolve) => setTimeout(resolve, 10000)) // Sync new blocks in every 10 seconds
    }
}
