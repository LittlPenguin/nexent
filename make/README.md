### 💻 Local Development Build

```bash
# 🔨 Build base image (current architecture only)
docker build -t nexent/nexent-base-commercial -f make/base/Dockerfile .

# 🚀 Build application image (current architecture only)
docker build -t nexent/nexent-commercial -f make/main/Dockerfile .

# 📊 Build data process image (current architecture only)
docker build -t nexent/nexent-data-process-commercial -f make/data_process/Dockerfile .

# 🌐 Build web frontend image (current architecture only)
docker build -t nexent/nexent-web-commercial -f make/web/Dockerfile .
```

### 🧹 Clean up Docker resources

```bash
# 🧼 Clean up Docker build cache and unused resources
docker builder prune -f && docker system prune -f
```

### 💾 Local Build and Load

```bash
# 🔨 Build and load base image (auto-detect local architecture)
docker buildx build --progress=plain -t nexent/nexent-base-commercial -f make/base/Dockerfile . --load

# 🚀 Build and load application image (auto-detect local architecture)
docker buildx build --progress=plain -t nexent/nexent-commercial -f make/main/Dockerfile . --load

# 📊 Build and load data process image (auto-detect local architecture)
docker buildx build --progress=plain -t nexent/nexent-data-process-commercial -f make/data_process/Dockerfile . --load

# 🌐 Build and load web frontend image (auto-detect local architecture)
docker buildx build --progress=plain -t nexent/nexent-web-commercial -f make/web/Dockerfile . --load
```

Notes:
- 🔧 Use `--platform linux/amd64,linux/arm64` to specify target architectures
- 📤 The `--push` flag automatically pushes the built images to Docker Hub
- 🔑 Make sure you are logged in to Docker Hub (`docker login`)
- ⚠️ If you encounter build errors, ensure Docker's buildx feature is enabled
- 🧹 Cleanup commands explanation:
  - `docker builder prune -f`: Cleans build cache
  - `docker system prune -f`: Cleans unused data (including dangling images, networks, etc.)
  - The `-f` flag forces execution without confirmation
- 🔧 The `--load` flag loads the built image into the local Docker images list
- ⚠️ `--load` can only be used with single architecture builds
- 📝 Use `docker images` to verify the images are loaded locally
- 📊 Use `--progress=plain` to see detailed build and push progress