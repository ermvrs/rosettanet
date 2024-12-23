import { AccountDeployError, AccountDeployResult } from "../utils/rosettanet";
import { EVMDecodeError, EVMDecodeResult, RosettanetSignature, RPCError, RPCResponse } from "./types";

export function isRPCError(value: unknown): value is RPCError {
    if (typeof value === "object" && value !== null) {
        const obj = value as RPCError;
        return typeof obj.id === "number" && typeof obj.jsonrpc === "string"  && typeof obj.error === "object"  && obj.error !== null && typeof obj.error.code === 'number' && typeof obj.error.message === 'string';
    }
    return false;
}

export function isRPCResponse(value: unknown): value is RPCResponse {
    if (typeof value === "object" && value !== null) {
        const obj = value as RPCResponse;
        return typeof obj.id === "number" && typeof obj.jsonrpc === "string"  && obj.result !== null;
    }
    return false;
}

export function isAccountDeployError(value: unknown): value is AccountDeployError {
    if (typeof value === "object" && value !== null) {
      const obj = value as AccountDeployError;
      return typeof obj.code === "number" && typeof obj.message === "string";
    }
    return false;
  }
  
export function isAccountDeployResult(value: unknown): value is AccountDeployResult {
    if (typeof value === "object" && value !== null) {
        const obj = value as AccountDeployResult;
        return typeof obj.transactionHash === "string" && typeof obj.contractAddress === "string";
    }
    return false;
}

export function isEVMDecodeError(value: unknown): value is EVMDecodeError {
    if (typeof value === "object" && value !== null) {
        const obj = value as EVMDecodeError;
        return typeof obj.message === "string" && typeof obj.code === "number";
    }
    return false;
}

export function isEVMDecodeResult(value: unknown): value is EVMDecodeResult {
    if (typeof value === "object" && value !== null) {
        const obj = value as EVMDecodeResult;
        return Array.isArray(obj.calldata) && Array.isArray(obj.directives);
    }
    return false;
}

export function isRosettanetSignature(value: unknown): value is RosettanetSignature {
    if (typeof value === "object" && value !== null) {
        const obj = value as RosettanetSignature;
        return typeof obj.r === 'string' && typeof obj.s === 'string' && typeof obj.v === 'number' && typeof obj.value === 'bigint' && Array.isArray(obj.arrayified) && obj.arrayified.length == 7
    }
    return false;
}