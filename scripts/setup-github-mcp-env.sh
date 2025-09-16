#!/bin/bash

# GitHub MCP Environment Setup Script
# This script helps manage the GitHub Personal Access Token for MCP integration

set -e

# Color output (if terminal)
if [ -t 2 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if running in CI/CD environment
is_ci() {
    [[ -n "$CI" ]] || [[ -n "$GITHUB_ACTIONS" ]] || [[ -n "$GITLAB_CI" ]] || [[ -n "$JENKINS_URL" ]]
}

# Function to securely read token input
read_token_securely() {
    local token=""
    if is_ci; then
        # In CI/CD environments, read from environment variable or stdin
        if [[ -n "$INPUT_GITHUB_TOKEN" ]]; then
            token="$INPUT_GITHUB_TOKEN"
        else
            read -r token
        fi
    else
        # Interactive mode - hide input
        echo -n "Enter your GitHub Personal Access Token: "
        read -rs token
        echo  # Add newline after hidden input
    fi
    echo "$token"
}

# Function to validate GitHub token format
validate_token() {
    local token="$1"
    
    # Check if token is empty
    if [[ -z "$token" ]]; then
        print_error "GitHub token cannot be empty"
        return 1
    fi
    
    # Basic format validation (GitHub tokens start with ghp_, gho_, ghu_, ghs_, or ghr_)
    if ! [[ "$token" =~ ^gh[poushr]_[A-Za-z0-9_]{36,255}$ ]]; then
        print_warning "Token format doesn't match standard GitHub token pattern, but will proceed"
    fi
    
    return 0
}

# Function to test GitHub token
test_token() {
    local token="$1"
    
    # Only test if we're not in CI and curl is available
    if ! is_ci && command_exists curl; then
        print_status "Testing GitHub token..."
        if curl -s -H "Authorization: token $token" -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/user" >/dev/null; then
            print_status "GitHub token is valid"
            return 0
        else
            print_warning "Could not verify GitHub token (this may be OK if token has limited scopes)"
            return 0  # Don't fail, as token might work for MCP even if API test fails
        fi
    fi
    
    return 0
}

# Function to save token to config file
save_token_to_config() {
    local token="$1"
    local config_dir="$HOME/.config/devflow"
    local config_file="$config_dir/github-mcp-env"
    
    # Create config directory if it doesn't exist
    mkdir -p "$config_dir"
    
    # Save token to config file
    echo "GITHUB_PERSONAL_ACCESS_TOKEN=$token" > "$config_file"
    
    # Set secure permissions
    chmod 600 "$config_file"
    
    print_status "Token saved to $config_file"
    print_status "To use the token, run: source $config_file"
}

# Function to export token to current environment
export_token() {
    local token="$1"
    export GITHUB_PERSONAL_ACCESS_TOKEN="$token"
    print_status "Token exported to current environment"
    print_status "To make it permanent, add the following to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
    echo "export GITHUB_PERSONAL_ACCESS_TOKEN=$token"
}

# Main setup function
setup_github_mcp_env() {
    print_status "GitHub MCP Environment Setup"
    echo "----------------------------"
    
    # Check if token is already provided as argument
    local token=""
    if [[ -n "$1" ]]; then
        token="$1"
    else
        # Read token from user
        token=$(read_token_securely)
    fi
    
    # Validate token
    if ! validate_token "$token"; then
        exit 1
    fi
    
    # Test token
    if ! test_token "$token"; then
        print_warning "Token validation failed, but continuing with setup"
    fi
    
    # Save to config file
    if save_token_to_config "$token"; then
        print_status "Configuration file created successfully"
    else
        print_warning "Could not save to configuration file"
    fi
    
    # Export to current environment
    export_token "$token"
    
    echo
    print_status "Setup complete!"
    print_status "To use in future sessions, run: source ~/.config/devflow/github-mcp-env"
}

# Function to show help
show_help() {
    echo "GitHub MCP Environment Setup Script"
    echo
    echo "Usage:"
    echo "  ./setup-github-mcp-env.sh                # Interactive setup"
    echo "  ./setup-github-mcp-env.sh <token>        # Setup with provided token"
    echo "  ./setup-github-mcp-env.sh --help         # Show this help"
    echo
    echo "This script helps configure your GitHub Personal Access Token for use with"
    echo "the GitHub MCP Server across all CLI platforms (Claude Code, Codex, Gemini, Qwen)."
    echo
    echo "Requirements:"
    echo "  - GitHub Personal Access Token with appropriate scopes:"
    echo "    * repo (Full control of private repositories)"
    echo "    * read:org (Read org and team membership)"
    echo "    * read:user (Read user profile data)"
    echo "    * read:project (Read project data)"
    echo
    echo "The script will:"
    echo "  1. Validate your token format"
    echo "  2. Save the token to ~/.config/devflow/github-mcp-env"
    echo "  3. Export the token to your current environment"
    echo
    echo "To make the token available in future sessions, add this to your shell profile:"
    echo "  source ~/.config/devflow/github-mcp-env"
}

# Main script logic
case "${1:-}" in
    --help|-h|help)
        show_help
        ;;
    "")
        setup_github_mcp_env
        ;;
    *)
        setup_github_mcp_env "$1"
        ;;
esac