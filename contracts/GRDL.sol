// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GRDL Token
 * @dev Native token for the GREEDYLM AI network.
 * Handles reputation staking and agent rewards.
 */
contract GRDL is ERC20, Ownable {
    constructor() ERC20("GREEDYLM Token", "GRDL") Ownable(msg.sender) {
        _mint(msg.sender, 1000000000 * 10**decimals()); // 1B supply
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
