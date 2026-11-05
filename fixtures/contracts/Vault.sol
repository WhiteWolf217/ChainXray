// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Vault {
    address public owner;
    event OwnerChanged(address indexed previous, address indexed next);
    constructor() { owner = msg.sender; }
    function setOwner(address next) external {
        emit OwnerChanged(owner,next);
        owner = next;
    }
}
