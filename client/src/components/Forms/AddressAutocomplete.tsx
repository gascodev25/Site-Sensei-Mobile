import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  extracted_house_number?: string;
  original_query?: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onAddressSelect: (address: string, lat: number, lng: number, city?: string, postcode?: string) => void;
  placeholder?: string;
  "data-testid"?: string;
}

export default function AddressAutocomplete({
  value,
  onAddressSelect,
  placeholder = "Start typing address...",
  "data-testid": testId
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const { toast } = useToast();

  const searchAddressMutation = useMutation({
    mutationFn: async (query: string) => {
      // Extract house number if present
      const houseNumberMatch = query.match(/^(\d+)\s+(.+)/);
      const houseNumber = houseNumberMatch ? houseNumberMatch[1] : null;
      const streetQuery = houseNumberMatch ? houseNumberMatch[2] : query;
      
      // Try multiple search strategies
      const searchUrls = [
        // First try the full address with structured search if house number exists
        ...(houseNumber ? [
          `https://nominatim.openstreetmap.org/search?format=json&housenumber=${encodeURIComponent(houseNumber)}&street=${encodeURIComponent(streetQuery)}&countrycodes=za&addressdetails=1&limit=3`
        ] : []),
        // Then try the full query
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=za&addressdetails=1&limit=5`,
        // Finally try just the street name if house number was present
        ...(houseNumber ? [
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(streetQuery)}&countrycodes=za&addressdetails=1&limit=3`
        ] : [])
      ];

      let allResults: any[] = [];
      
      for (const url of searchUrls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              // Add house number info to results if we extracted one
              const enrichedData = data.map((result: any) => ({
                ...result,
                extracted_house_number: houseNumber,
                original_query: query
              }));
              allResults = [...allResults, ...enrichedData];
            }
          }
        } catch (error) {
          console.warn("Search failed for URL:", url, error);
        }
      }
      
      // Remove duplicates based on place_id and limit results
      const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.place_id === result.place_id)
      ).slice(0, 5);
      
      return uniqueResults;
    },
    onSuccess: (data) => {
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error("Address search error:", error);
      setIsLoading(false);
      setSuggestions([]);
      setShowSuggestions(false);
    },
  });

  const debounceSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (query: string) => {
        clearTimeout(timeoutId);
        if (query.trim().length < 3) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        timeoutId = setTimeout(() => {
          setIsLoading(true);
          searchAddressMutation.mutate(query);
        }, 300);
      };
    })(),
    [searchAddressMutation]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    debounceSearch(newValue);
  };

  const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);

    // Re-geocode to get precise coordinates and detailed address information
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(suggestion.display_name)}&limit=1&addressdetails=1`
      );
      const data = await response.json();

      if (data.length > 0) {
        const result = data[0];
        const preciseLat = parseFloat(result.lat);
        const preciseLng = parseFloat(result.lon);
        
        // Extract city from multiple possible fields
        const city = result.address?.city || 
                    result.address?.town || 
                    result.address?.village || 
                    result.address?.municipality ||
                    result.address?.county ||
                    result.address?.suburb;
        
        const postcode = result.address?.postcode;

        // Build the street address, preserving extracted house number if available
        const streetAddress = (() => {
          // If we have an extracted house number and no house number from API
          if (suggestion.extracted_house_number && !result.address?.house_number) {
            const road = result.address?.road;
            return road ? `${suggestion.extracted_house_number} ${road}` : suggestion.original_query;
          }
          
          // If API has house number, use it
          if (result.address?.house_number && result.address?.road) {
            return `${result.address.house_number} ${result.address.road}`;
          }
          
          // Fallback to road only or original display name
          return result.address?.road || suggestion.display_name;
        })();

        setInputValue(streetAddress || suggestion.display_name);
        onAddressSelect(streetAddress || suggestion.display_name, preciseLat, preciseLng, city, postcode);
        setShowSuggestions(false);
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Re-geocoding error:", error);
      // Fallback to original coordinates with basic city extraction
      const city = suggestion.address?.city || suggestion.address?.town;
      const postcode = suggestion.address?.postcode;
      
      // Build the street address, preserving extracted house number if available
      const streetAddress = (() => {
        // If we have an extracted house number, use the original query
        if (suggestion.extracted_house_number) {
          return suggestion.original_query;
        }
        
        // Otherwise, extract just the street address from display_name
        const parts = suggestion.display_name.split(',');
        return parts[0] || suggestion.display_name;
      })();
      
      setInputValue(streetAddress || suggestion.display_name);
      onAddressSelect(streetAddress || suggestion.display_name, lat, lng, city, postcode);
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleManualEntry = () => {
    toast({
      title: "Manual Address Entry",
      description: "Please ensure the address is accurate and set the location on the map if needed.",
    });
    setShowSuggestions(false);
    onAddressSelect(inputValue, 0, 0); // Will need manual lat/lng setting
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          data-testid={testId}
          onBlur={() => {
            // Delay hiding suggestions to allow click events
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
        />
        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      </div>

      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Searching...</div>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((suggestion, index) => {
                // Create a display name that includes house number if available
                const displayName = (() => {
                  // If we have an extracted house number and this is a street-level result
                  if (suggestion.extracted_house_number && !suggestion.address?.house_number) {
                    const streetName = suggestion.address?.road || suggestion.name;
                    if (streetName) {
                      // Show house number + street + area info
                      const areaInfo = [
                        suggestion.address?.suburb,
                        suggestion.address?.city || suggestion.address?.town,
                        suggestion.address?.state
                      ].filter(Boolean).join(', ');
                      
                      return `${suggestion.extracted_house_number} ${streetName}${areaInfo ? `, ${areaInfo}` : ''}`;
                    }
                  }
                  
                  // If the API returned a house number, use it
                  if (suggestion.address?.house_number) {
                    return suggestion.display_name;
                  }
                  
                  // Default to the original display name
                  return suggestion.display_name;
                })();

                return (
                  <button
                    key={index}
                    type="button"
                    className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 text-sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    data-testid={`suggestion-${index}`}
                  >
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{displayName}</div>
                        {suggestion.extracted_house_number && !suggestion.address?.house_number && (
                          <div className="text-xs text-muted-foreground mt-1">
                            House number preserved from your input
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="p-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleManualEntry}
                  className="w-full justify-start text-xs"
                  data-testid="button-manual-entry"
                >
                  Use "{inputValue}" as-is (manual entry)
                </Button>
              </div>
            </>
          ) : inputValue.trim().length >= 3 ? (
            <div className="p-3">
              <div className="text-sm text-muted-foreground mb-2">No addresses found</div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleManualEntry}
                className="w-full justify-start text-xs"
                data-testid="button-manual-entry-no-results"
              >
                Use "{inputValue}" as-is (manual entry)
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}