import { getDevAccount, SERVER } from '../utils'
import { registerContractIfNotRegistered } from '../registry/rosettanet'
import { ethers } from 'ethers';
import { ETH_ADDRESS } from '../constants';

const snAddress =
  '0x06419f7dea356b74bc1443bd1600ab3831b7808d1ef897789facfad11a172da7'
describe('Using ethers.js with Rosettanet RPC', () => {
    test.only('Retrive balance of the account', async () => {
        const ethAddress = await registerContractIfNotRegistered(
            getDevAccount(),
            snAddress,
          );
        const provider = new ethers.JsonRpcProvider(SERVER);
        const balanceWei = await provider.getBalance(ethAddress);
  
        // Convert balance to Ether string
        const balanceEther = ethers.formatEther(balanceWei);
        expect(balanceEther).toBe("249.210533684940172681")
    }, 30000)

    test.only('Retrive eth balance using erc20 contract', async () => {
        const ethAddress = await registerContractIfNotRegistered(
            getDevAccount(),
            snAddress,
          );
        const ethTokenAddress = await registerContractIfNotRegistered(getDevAccount(), ETH_ADDRESS);
        const provider = new ethers.JsonRpcProvider(SERVER);
        const ERC20_ABI = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)'
          ];
        const tokenContract = new ethers.Contract(ethTokenAddress, ERC20_ABI, provider);
        
        // Get balance
        const balance = await tokenContract.balanceOf(ethAddress);
        
        // Get token decimals
        const decimals = await tokenContract.decimals();
        expect(balance).toBe(BigInt(1461819925596660))
        expect(decimals).toBe(BigInt(18))
    }, 30000)
})