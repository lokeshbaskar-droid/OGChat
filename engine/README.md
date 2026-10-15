# OGChat Custom Inference Engine

This directory is the starting point for a native C++ inference engine intended to be developed alongside OGChat.

## Scope of this first milestone

- Establish a portable C++17 build and test setup.
- Add a small, checked row-major tensor type and a reference matrix-multiplication operation.
- Create deterministic tests before implementing model-specific math.
- Keep the existing Ollama integration and model files untouched.

## Important status

**This is an engine foundation, not yet a GPT-OSS inference runtime.** It does not load Ollama's internal model storage, implement MXFP4, tokenize GPT-OSS messages, execute the GPT-OSS architecture, or generate model tokens. Those require separate, verified milestones.

## Build (Windows)

Install a C++ compiler with CMake support and CMake 3.20 or newer.

From the repository root:

```powershell
cmake -S engine -B engine/build
cmake --build engine/build --config Release
ctest --test-dir engine/build -C Release --output-on-failure
```

The project has no third-party C++ dependencies in this initial milestone.

## Planned milestones

1. **Foundation:** tensor shape/storage validation and reference operations.
2. **Model-format research:** inspect official GPT-OSS architecture, tokenizer, and MXFP4 representation without modifying model files.
3. **Numerical primitives:** implement and test the operations required by the architecture.
4. **Model execution:** add the model-specific forward pass only after the tensor operations have reference tests.
5. **Generation:** tokenizer/message formatting, KV cache, sampling, and streaming.
6. **Backend integration:** expose a local API for OGChat, keeping it separate from the existing backend until verified.

## Design principles

- Never delete, move, or rewrite the user's existing model files as part of development.
- Prefer correctness tests before optimization.
- Keep unsupported model formats explicit; do not silently interpret MXFP4 weights as ordinary floating-point tensors.
- Treat model files and prompts as untrusted input and validate sizes before allocation.
