#!/bin/bash

echo "Testing OSINT CRM API endpoints..."
echo "=================================="

# Test entity network endpoint
echo -e "\n1. Testing Entity Network API:"
response=$(curl -s -w "HTTP_CODE:%{http_code}" "http://localhost:3001/api/entity-network")
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
data=$(echo "$response" | sed 's/HTTP_CODE:.*$//')

if [ "$http_code" = "200" ]; then
    echo "✅ Entity Network API: SUCCESS"
    nodes=$(echo "$data" | grep -o '"nodes":\[' | wc -l)
    edges=$(echo "$data" | grep -o '"edges":\[' | wc -l)
    echo "   Response contains nodes and edges arrays"
    # Count actual entities
    person_count=$(echo "$data" | grep -o '"type":"person"' | wc -l)
    business_count=$(echo "$data" | grep -o '"type":"business"' | wc -l)
    location_count=$(echo "$data" | grep -o '"type":"location"' | wc -l)
    echo "   Entities found: $person_count people, $business_count businesses, $location_count locations"
else
    echo "❌ Entity Network API: FAILED (HTTP $http_code)"
    echo "   Response: $data"
fi

# Test locations endpoint
echo -e "\n2. Testing Locations API:"
response=$(curl -s -w "HTTP_CODE:%{http_code}" "http://localhost:3001/api/locations?limit=10&confidence=0")
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
data=$(echo "$response" | sed 's/HTTP_CODE:.*$//')

if [ "$http_code" = "200" ]; then
    echo "✅ Locations API: SUCCESS"
    # Count people with locations
    people_count=$(echo "$data" | grep -o '"id":[0-9]*' | head -10 | wc -l)
    geocoded_count=$(echo "$data" | grep -o '"geocoded":true' | wc -l)
    echo "   Found $people_count people, $geocoded_count with geocoded locations"
else
    echo "❌ Locations API: FAILED (HTTP $http_code)"
    echo "   Response: $data"
fi

# Test frontend accessibility
echo -e "\n3. Testing Frontend Accessibility:"
response=$(curl -s -w "HTTP_CODE:%{http_code}" "http://localhost:8080")
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$http_code" = "200" ]; then
    echo "✅ Frontend: SUCCESS"
    echo "   Application is accessible at http://localhost:8080"
else
    echo "❌ Frontend: FAILED (HTTP $http_code)"
fi

echo -e "\n=================================="
echo "Test Summary:"
echo "- Backend API: http://localhost:3001"
echo "- Frontend App: http://localhost:8080"
echo "- Access the app in your browser to test the new simplified components"
echo "- Map should show in 'Locations' tab"
echo "- Entity network should show in 'Entity Network' tab and Dashboard"