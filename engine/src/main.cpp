#include <iostream>

#include "ogengine/tensor.hpp"

int main() {
    // Small deterministic smoke test for the tensor runtime foundation.
    ogengine::Tensor lhs({2, 2});
    lhs.data() = {1.0F, 2.0F, 3.0F, 4.0F};

    ogengine::Tensor rhs({2, 2});
    rhs.data() = {5.0F, 6.0F, 7.0F, 8.0F};

    const auto result = ogengine::matmul(lhs, rhs);
    std::cout << "OGChat Engine foundation demo (not GPT-OSS inference)\n";
    std::cout << "matmul result: [";
    for (std::size_t i = 0; i < result.numel(); ++i) {
        if (i != 0) std::cout << ", ";
        std::cout << result.data()[i];
    }
    std::cout << "]\n";
    return 0;
}
