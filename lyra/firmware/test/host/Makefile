CORE := ../../lib/lyra_core
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -I$(CORE)/include

sim: sim.cpp $(wildcard $(CORE)/src/*.cpp) $(wildcard $(CORE)/include/lyra/*.h)
	$(CXX) $(CXXFLAGS) sim.cpp $(CORE)/src/*.cpp -o $@

access_sim: access_sim.cpp $(wildcard $(CORE)/src/*.cpp) $(wildcard $(CORE)/include/lyra/*.h)
	$(CXX) $(CXXFLAGS) access_sim.cpp $(CORE)/src/access.cpp -o $@

access: access_sim
	./access_sim

run: sim access_sim
	./access_sim
	./sim

clean:
	rm -f sim access_sim

.PHONY: run access clean
