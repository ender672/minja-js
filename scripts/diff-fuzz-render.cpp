/*
    Differential fuzzing harness for minja (C++ side).
    Reads JSON lines from stdin, each with "template" and "context" fields.
    Renders the template with the given context and outputs a JSON line with
    "result" (string or null) and "error" (string or null).

    Build against the C++ minja library (https://github.com/ochafik/minja):

        c++ -std=c++17 -I/path/to/minja/include -I/path/to/nlohmann/json/include \
            -o diff-fuzz-render diff-fuzz-render.cpp
*/
// SPDX-License-Identifier: MIT
#include <minja/minja.hpp>
#include <iostream>
#include <string>

using json = nlohmann::ordered_json;

int main() {
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        json output;
        try {
            auto input = json::parse(line);
            auto template_str = input.at("template").get<std::string>();
            auto context_json = input.value("context", json::object());

            auto root = minja::Parser::parse(template_str, {});
            auto context = minja::Context::make(minja::Value(context_json));
            auto result = root->render(context);

            output["result"] = result;
            output["error"] = nullptr;
        } catch (const std::exception& e) {
            output["result"] = nullptr;
            output["error"] = std::string(e.what());
        }
        std::cout << output.dump() << "\n";
        std::cout.flush();
    }
    return 0;
}
