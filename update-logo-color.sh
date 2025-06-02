#!/bin/bash

# Directory containing email templates
TEMPLATES_DIR="src/templates/emails"

# Find all .hbs files and update the logo styling
for template in "$TEMPLATES_DIR"/*.hbs; do
    # Add filter to make logo white
    sed -i '/.logo {/,/}/ s/display: block !important;/display: block !important;\n            filter: brightness(0) invert(1) !important;/' "$template"
    sed -i '/.logo img {/,/}/ s/margin: 0 auto !important;/margin: 0 auto !important;\n            filter: brightness(0) invert(1) !important;/' "$template"
done

echo "Updated logo styling in all email templates to be white by default" 