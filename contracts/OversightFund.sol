// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./GRDL.sol";

/**
 * @title Oversight Fund
 * @dev Vault for holding GRDL tokens used for community oversight rewards.
 */
contract OversightFund is Ownable {
    GRDL public grdlToken;
    
    mapping(address => uint256) public totalDonated;

    event DonationReceived(address indexed donor, uint256 amount);
    event RewardDistributed(address indexed agent, uint256 amount);

    constructor(address _grdlToken) Ownable(msg.sender) {
        grdlToken = GRDL(_grdlToken);
    }

    function donate(uint256 amount) external {
        grdlToken.transferFrom(msg.sender, address(this), amount);
        totalDonated[msg.sender] += amount;
        emit DonationReceived(msg.sender, amount);
    }

    function distributeReward(address agent, uint256 amount) external onlyOwner {
        require(grdlToken.balanceOf(address(this)) >= amount, "Insufficient fund balance");
        grdlToken.transfer(agent, amount);
        emit RewardDistributed(agent, amount);
    }

    function getBalance() public view returns (uint256) {
        return grdlToken.balanceOf(address(this));
    }
}
