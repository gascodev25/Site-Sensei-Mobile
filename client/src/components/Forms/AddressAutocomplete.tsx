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

function extractStreetAddress(suggestion: AddressSuggestion, userQuery: string): string {
  const addr = suggestion.address;

  if (addr?.house_number && addr?.road) {
    return `${addr.house_number} ${addr.road}`;
  }

  const displayParts = suggestion.display_name.split(',');
  const firstPart = displayParts[0]?.trim() || '';

  if (/^\d/.test(firstPart)) {
    return firstPart;
  }

  const numberMatch = userQuery.match(/^(\d+[\w]*)\s+/);
  if (numberMatch && addr?.road) {
    const typedNumber = numberMatch[1];
    if (!addr.road.startsWith(typedNumber)) {
      return `${typedNumber} ${addr.road}`;
    }
  }

  if (addr?.road) {
    return addr.road;
  }

  return firstPart;
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
  const [lastQuery, setLastQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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

  const searchAddress = async (query: string): Promise<AddressSuggestion[]> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(query)}`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return [];
      }
      throw error;
    }
  };

  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      
      return async (query: string) => {
        clearTimeout(timeoutId);
        
        if (query.trim().length < 3) {
          setSuggestions([]);
          setShowSuggestions(false);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        timeoutId = setTimeout(async () => {
          try {
            setLastQuery(query);
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
        }, 300);
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

    const city = suggestion.address?.city || 
                suggestion.address?.town || 
                suggestion.address?.village || 
                suggestion.address?.suburb;
    
    const postcode = suggestion.address?.postcode;

    const streetAddress = extractStreetAddress(suggestion, lastQuery || inputValue);

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
                const displayStreet = extractStreetAddress(suggestion, lastQuery || inputValue);
                const area = [
                  suggestion.address?.suburb,
                  suggestion.address?.city || suggestion.address?.town || suggestion.address?.village
                ].filter(Boolean).join(', ');
                const displayName = area ? `${displayStreet}, ${area}` : displayStreet;

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
