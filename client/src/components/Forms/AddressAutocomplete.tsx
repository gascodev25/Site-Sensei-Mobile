import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddressSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search function with proper error handling
  const searchAddress = async (query: string): Promise<AddressSuggestion[]> => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&` +
        `q=${encodeURIComponent(query)}&` +
        `countrycodes=za&` +
        `addressdetails=1&` +
        `limit=5`,
        { 
          signal: abortControllerRef.current.signal,
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        return [];
      }
      throw error;
    }
  };

  // Debounced search with proper async handling
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      
      return async (query: string) => {
        clearTimeout(timeoutId);
        
        // Reset if query too short
        if (query.trim().length < 3) {
          setSuggestions([]);
          setShowSuggestions(false);
          setIsLoading(false);
          return;
        }

        timeoutId = setTimeout(async () => {
          setIsLoading(true);
          setSuggestions([]);
          
          try {
            const results = await searchAddress(query);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
          } catch (error) {
            console.error("Address search error:", error);
            setSuggestions([]);
            setShowSuggestions(false);
          } finally {
            setIsLoading(false);
          }
        }, 500); // 500ms debounce
      };
    })(),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    debouncedSearch(newValue);
  };

  const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);

    // Extract address components
    const city = suggestion.address?.city || 
                suggestion.address?.town || 
                suggestion.address?.village || 
                suggestion.address?.suburb;
    
    const postcode = suggestion.address?.postcode;

    // Build readable address
    let streetAddress = '';
    if (suggestion.address?.house_number && suggestion.address?.road) {
      streetAddress = `${suggestion.address.house_number} ${suggestion.address.road}`;
    } else if (suggestion.address?.road) {
      streetAddress = suggestion.address.road;
    } else {
      // Fallback to first part of display name
      const parts = suggestion.display_name.split(',');
      streetAddress = parts[0].trim();
    }

    setInputValue(streetAddress);
    onAddressSelect(streetAddress, lat, lng, city, postcode);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleManualEntry = () => {
    toast({
      title: "Manual Address Entry",
      description: "Please ensure the address is accurate. You may need to set the location manually.",
    });
    setShowSuggestions(false);
    onAddressSelect(inputValue, 0, 0);
  };

  const handleInputFocus = () => {
    // Show existing suggestions if we have them and query is long enough
    if (suggestions.length > 0 && inputValue.trim().length >= 3) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          data-testid={testId}
          autoComplete="off"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 animate-spin" />
        ) : (
          <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        )}
      </div>

      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((suggestion, index) => {
                // Create readable display name
                let displayName = suggestion.display_name;
                if (suggestion.address?.house_number && suggestion.address?.road) {
                  const area = [
                    suggestion.address?.suburb,
                    suggestion.address?.city || suggestion.address?.town
                  ].filter(Boolean).join(', ');
                  displayName = `${suggestion.address.house_number} ${suggestion.address.road}${area ? `, ${area}` : ''}`;
                }

                return (
                  <button
                    key={suggestion.place_id}
                    type="button"
                    className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 text-sm transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                    data-testid={`suggestion-${index}`}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{displayName}</div>
                        {suggestion.address?.postcode && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {suggestion.address.postcode}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="p-2 border-t border-border bg-muted/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleManualEntry}
                  className="w-full justify-start text-xs"
                  data-testid="button-manual-entry"
                >
                  Use "{inputValue}" as entered
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
