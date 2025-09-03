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
  address?: {
    city?: string;
    town?: string;
    postcode?: string;
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=za`
      );
      if (!response.ok) {
        throw new Error("Failed to search addresses");
      }
      return response.json();
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
    const city = suggestion.address?.city || suggestion.address?.town;
    const postcode = suggestion.address?.postcode;

    // Re-geocode to get precise coordinates
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(suggestion.display_name)}&limit=1`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const preciseLat = parseFloat(data[0].lat);
        const preciseLng = parseFloat(data[0].lon);
        
        setInputValue(suggestion.display_name);
        onAddressSelect(suggestion.display_name, preciseLat, preciseLng, city, postcode);
        setShowSuggestions(false);
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Re-geocoding error:", error);
      // Fallback to original coordinates
      setInputValue(suggestion.display_name);
      onAddressSelect(suggestion.display_name, lat, lng, city, postcode);
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
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 text-sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                  data-testid={`suggestion-${index}`}
                >
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span>{suggestion.display_name}</span>
                  </div>
                </button>
              ))}
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
