#!/bin/bash

# Script to install TypeScript type definitions for dependencies

echo "Installing TypeScript type definitions..."

# Install all required @types packages
npm install --save-dev \
  @types/bcryptjs \
  @types/compression \
  @types/cookie-parser \
  @types/morgan \
  @types/nodemailer \
  @types/passport \
  @types/passport-facebook \
  @types/passport-google-oauth20 \
  @types/qrcode \
  @types/socket.io-client \
  @types/speakeasy \
  @types/ws

echo "Type definitions installed successfully!"
