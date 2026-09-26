CORE := ../../lib/lyra_core
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -I$(CORE)/include

sim: sim.cpp $(wildcard $(CORE)/src/*.cpp) $(wildcard $(CORE)/include/lyra/*.h)
	$(CXX) $(CXXFLAGS) sim.cpp $(CORE)/src/*.cpp -o $@

run: sim
	./sim

clean:
	rm -f sim

.PHONY: run clean
