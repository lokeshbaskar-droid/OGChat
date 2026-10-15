#pragma once

#include <cstddef>
#include <limits>
#include <stdexcept>
#include <utility>
#include <vector>

namespace ogengine {

// Minimal contiguous row-major float tensor for correctness-first prototypes.
// This is not an optimized GPU tensor implementation.
class Tensor {
public:
    Tensor(std::vector<std::size_t> shape, float fill_value = 0.0F)
        : shape_(std::move(shape)), data_(checked_numel(shape_), fill_value) {
        if (shape_.empty()) {
            throw std::invalid_argument("Tensor shape must have at least one dimension");
        }
    }

    const std::vector<std::size_t>& shape() const noexcept { return shape_; }
    const std::vector<float>& data() const noexcept { return data_; }
    std::vector<float>& data() noexcept { return data_; }
    std::size_t numel() const noexcept { return data_.size(); }

    float& at(std::size_t index) { return data_.at(index); }
    const float& at(std::size_t index) const { return data_.at(index); }

private:
    static std::size_t checked_numel(const std::vector<std::size_t>& shape) {
        if (shape.empty()) {
            throw std::invalid_argument("Tensor shape must have at least one dimension");
        }

        std::size_t count = 1;
        for (const auto dim : shape) {
            if (dim == 0) {
                throw std::invalid_argument("Tensor dimensions must be non-zero");
            }
            if (count > std::numeric_limits<std::size_t>::max() / dim) {
                throw std::overflow_error("Tensor element count overflows size_t");
            }
            count *= dim;
        }
        return count;
    }

    std::vector<std::size_t> shape_;
    std::vector<float> data_;
};

// Correctness-oriented reference matmul: [M,K] x [K,N] -> [M,N].
inline Tensor matmul(const Tensor& lhs, const Tensor& rhs) {
    if (lhs.shape().size() != 2 || rhs.shape().size() != 2) {
        throw std::invalid_argument("matmul expects two 2D tensors");
    }

    const auto m = lhs.shape()[0];
    const auto k = lhs.shape()[1];
    const auto rhs_k = rhs.shape()[0];
    const auto n = rhs.shape()[1];
    if (k != rhs_k) {
        throw std::invalid_argument("matmul inner dimensions do not match");
    }

    Tensor output({m, n});
    for (std::size_t i = 0; i < m; ++i) {
        for (std::size_t j = 0; j < n; ++j) {
            float sum = 0.0F;
            for (std::size_t p = 0; p < k; ++p) {
                sum += lhs.data()[i * k + p] * rhs.data()[p * n + j];
            }
            output.data()[i * n + j] = sum;
        }
    }
    return output;
}

} // namespace ogengine
