cmake_minimum_required(VERSION 3.20)

project(ogchat_engine
    VERSION 0.1.0
    DESCRIPTION "Experimental custom C++ inference engine foundation for OGChat"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(ogengine INTERFACE)
target_include_directories(ogengine INTERFACE "${CMAKE_CURRENT_SOURCE_DIR}/include")

if(MSVC)
    target_compile_options(ogengine INTERFACE /W4 /permissive-)
else()
    target_compile_options(ogengine INTERFACE -Wall -Wextra -Wpedantic)
endif()

add_executable(ogengine_demo src/main.cpp)
target_link_libraries(ogengine_demo PRIVATE ogengine)

include(CTest)
if(BUILD_TESTING)
    add_executable(ogengine_tensor_tests tests/tensor_tests.cpp)
    target_link_libraries(ogengine_tensor_tests PRIVATE ogengine)
    add_test(NAME tensor_tests COMMAND ogengine_tensor_tests)
endif()
