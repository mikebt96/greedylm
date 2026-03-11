// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StakingPool is Ownable {
    IERC20 public token;
    
    struct Stake {
        uint256 amount;
        uint256 stakedAt;
        bool slashed;
    }
    
    mapping(string => Stake) public agentStakes; // Agent DID -> Stake
    
    event Staked(string agentDid, uint256 amount);
    event Slashed(string agentDid, uint256 amount);
    
    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }
    
    function stake(string memory agentDid, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        token.transferFrom(msg.sender, address(this), amount);
        
        agentStakes[agentDid].amount += amount;
        agentStakes[agentDid].stakedAt = block.timestamp;
        
        emit Staked(agentDid, amount);
    }
    
    function slash(string memory agentDid, uint256 percentage) external onlyOwner {
        require(percentage <= 100, "Percentage must be <= 100");
        Stake storage s = agentStakes[agentDid];
        require(s.amount > 0, "No stake to slash");
        
        uint256 slashAmount = (s.amount * percentage) / 100;
        s.amount -= slashAmount;
        s.slashed = true;
        
        // Slashed funds could be burned or sent to Oversight Fund
        token.transfer(owner(), slashAmount);
        
        emit Slashed(agentDid, slashAmount);
    }
}
