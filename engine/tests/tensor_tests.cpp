#include <cmath>
#include <exception>
#include <iostream>
#include <stdexcept>
#include <string>

#include "ogengine/tensor.hpp"

namespace {
void require(bool condition, const std::string& message) {
    if (!condition) throw std::runtime_error(message);
}

void test_matmul_values() {
    ogengine::Tensor lhs({2, 2});
    lhs.data() = {1.0F, 2.0F, 3.0F, 4.0F};
    ogengine::Tensor rhs({2, 2});
    rhs.data() = {5.0F, 6.0F, 7.0F, 8.0F};

    const auto result = ogengine::matmul(lhs, rhs);
    require(result.shape() == std::vector<std::size_t>({2, 2}), "matmul output shape");
    const float expected[] = {19.0F, 22.0F, 43.0F, 50.0F};
    for (std::size_t i = 0; i < 4; ++i) {
        require(std::fabs(result.data()[i] - expected[i]) < 1e-5F, "matmul value mismatch");
    }
}

void test_rejects_bad_shapes() {
    bool threw = false;
    try { ogengine::Tensor invalid({2, 0}); }
    catch (const std::invalid_argument&) { threw = true; }
    require(threw, "zero dimension must be rejected");

    threw = false;
    try {
        ogengine::Tensor lhs({2, 3});
        ogengine::Tensor rhs({2, 2});
        (void)ogengine::matmul(lhs, rhs);
    } catch (const std::invalid_argument&) { threw = true; }
    require(threw, "mismatched matmul dimensions must be rejected");
}
} // namespace

int main() {
    try {
        test_matmul_values();
        test_rejects_bad_shapes();
        std::cout << "All tensor foundation tests passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Test failure: " << error.what() << '\n';
        return 1;
    }
}
