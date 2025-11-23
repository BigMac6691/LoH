#!/bin/bash
# Generate JWT secrets for .env file
# Run this script to generate secure JWT secrets

echo "# JWT Secrets - Generated $(date)"
echo "# These are secure random values - keep them secret!"
echo ""
echo "JWT_SECRET=$(openssl rand -base64 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64)"
echo ""
echo "# Copy the JWT_SECRET and JWT_REFRESH_SECRET values above into your .env file"

