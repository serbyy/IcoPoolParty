#!/usr/bin/env bash
rm build/contracts/*
echo "Cleaned build folder."
cp test-abis/* build/contracts
echo "Copyied test ABI's to build folder."
echo "Compiling sources..."
truffle compile --all