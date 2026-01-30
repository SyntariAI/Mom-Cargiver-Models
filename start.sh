#!/bin/bash

# Mom's Caregiver Tracker - Startup Script
# Usage: ./start.sh [dev|docker|stop]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════╗"
    echo "║     Mom's Caregiver Tracker            ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

check_dependencies() {
    local missing=()

    if ! command -v python3 &> /dev/null; then
        missing+=("python3")
    fi

    if ! command -v node &> /dev/null; then
        missing+=("node")
    fi

    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing[*]}"
        echo "Please install the missing dependencies and try again."
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
}

start_dev() {
    print_header
    echo "Starting in DEVELOPMENT mode..."
    echo ""

    check_dependencies

    # Create data directory if it doesn't exist
    mkdir -p "$SCRIPT_DIR/data"

    # Install backend dependencies if needed
    if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
        print_status "Creating Python virtual environment..."
        cd "$SCRIPT_DIR/backend"
        python3 -m venv venv
    fi

    # Activate venv and install dependencies
    print_status "Installing backend dependencies..."
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    pip install -q -r requirements.txt

    # Install frontend dependencies if needed
    if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
        print_status "Installing frontend dependencies..."
        cd "$SCRIPT_DIR/frontend"
        npm install --silent
    fi

    # Start backend in background
    print_status "Starting backend server..."
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    uvicorn app.main:app --reload --port 8000 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$SCRIPT_DIR/.backend.pid"

    # Wait for backend to be ready
    echo -n "    Waiting for backend..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo " ready!"
            break
        fi
        echo -n "."
        sleep 1
    done

    # Start frontend in background
    print_status "Starting frontend server..."
    cd "$SCRIPT_DIR/frontend"
    npm run dev &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$SCRIPT_DIR/.frontend.pid"

    # Wait for frontend to be ready
    echo -n "    Waiting for frontend..."
    for i in {1..30}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo " ready!"
            break
        fi
        echo -n "."
        sleep 1
    done

    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Application is running!${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo ""
    echo "  Frontend:  http://localhost:5173"
    echo "  Backend:   http://localhost:8000"
    echo "  API Docs:  http://localhost:8000/docs"
    echo ""
    echo "  To stop: ./start.sh stop"
    echo ""

    # Keep script running and handle Ctrl+C
    trap 'stop_services; exit 0' INT TERM

    # Wait for processes
    wait
}

start_docker() {
    print_header
    echo "Starting with DOCKER..."
    echo ""

    check_docker

    # Create data directory if it doesn't exist
    mkdir -p "$SCRIPT_DIR/data"
    mkdir -p "$SCRIPT_DIR/backups"

    print_status "Building and starting containers..."
    docker-compose up -d --build

    # Wait for services to be ready
    echo -n "    Waiting for services..."
    for i in {1..60}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo " ready!"
            break
        fi
        echo -n "."
        sleep 1
    done

    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Application is running!${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo ""
    echo "  Frontend:  http://localhost"
    echo "  Backend:   http://localhost:8000"
    echo "  API Docs:  http://localhost:8000/docs"
    echo ""
    echo "  View logs: docker-compose logs -f"
    echo "  To stop:   ./start.sh stop"
    echo ""
}

stop_services() {
    print_header
    echo "Stopping services..."
    echo ""

    # Stop Docker containers if running
    if docker-compose ps -q 2>/dev/null | grep -q .; then
        print_status "Stopping Docker containers..."
        docker-compose down
    fi

    # Stop development processes
    if [ -f "$SCRIPT_DIR/.backend.pid" ]; then
        PID=$(cat "$SCRIPT_DIR/.backend.pid")
        if kill -0 "$PID" 2>/dev/null; then
            print_status "Stopping backend (PID: $PID)..."
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$SCRIPT_DIR/.backend.pid"
    fi

    if [ -f "$SCRIPT_DIR/.frontend.pid" ]; then
        PID=$(cat "$SCRIPT_DIR/.frontend.pid")
        if kill -0 "$PID" 2>/dev/null; then
            print_status "Stopping frontend (PID: $PID)..."
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$SCRIPT_DIR/.frontend.pid"
    fi

    # Kill any remaining uvicorn or vite processes for this project
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "vite.*frontend" 2>/dev/null || true

    print_status "All services stopped"
}

show_status() {
    print_header
    echo "Service Status:"
    echo ""

    # Check Docker
    if docker-compose ps -q 2>/dev/null | grep -q .; then
        echo -e "  Docker:   ${GREEN}Running${NC}"
        docker-compose ps
    else
        echo -e "  Docker:   ${YELLOW}Not running${NC}"
    fi

    echo ""

    # Check Backend
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "  Backend:  ${GREEN}Running${NC} (http://localhost:8000)"
    else
        echo -e "  Backend:  ${RED}Not running${NC}"
    fi

    # Check Frontend (dev)
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "  Frontend: ${GREEN}Running${NC} (http://localhost:5173 - dev)"
    elif curl -s http://localhost > /dev/null 2>&1; then
        echo -e "  Frontend: ${GREEN}Running${NC} (http://localhost - docker)"
    else
        echo -e "  Frontend: ${RED}Not running${NC}"
    fi

    echo ""
}

show_help() {
    print_header
    echo "Usage: ./start.sh [command]"
    echo ""
    echo "Commands:"
    echo "  dev      Start in development mode (default)"
    echo "           - Backend with hot reload on port 8000"
    echo "           - Frontend with hot reload on port 5173"
    echo ""
    echo "  docker   Start with Docker Compose"
    echo "           - Frontend on port 80"
    echo "           - Backend on port 8000"
    echo ""
    echo "  stop     Stop all services"
    echo ""
    echo "  status   Show service status"
    echo ""
    echo "  help     Show this help message"
    echo ""
}

# Main
case "${1:-dev}" in
    dev)
        start_dev
        ;;
    docker)
        start_docker
        ;;
    stop)
        stop_services
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
