# Better Parsing Approach for dumpsys connectivity

## Current Approach (network.ts)

```typescript
const caps = data["connectivity"]?.stdout?.match(/Capabilities:\s*([^\s]+)/);
const dns = data["connectivity"]?.stdout?.match(/DnsAddresses:\s*\[\s*([^\]]+)\s*\]/);
```

**Problems:**
1. ❌ Regex matches first occurrence only
2. ❌ Doesn't handle multiple networks
3. ❌ Fragile - breaks if format changes slightly
4. ❌ Hard to maintain complex patterns
5. ❌ No structured data extraction

## Better Approach: Structured Parsing

### Option 1: Section-based Parser (Recommended)

```typescript
interface NetworkInfo {
  networkId: string;
  type: string; // MOBILE, WIFI
  state: string;
  interfaceName: string;
  ipAddress: string;
  dnsServers: string[];
  gateway: string;
  mtu: number;
  capabilities: string[];
  bandwidth: {
    up: number;
    down: number;
  };
}

function parseConnectivity(stdout: string): NetworkInfo[] {
  const networks: NetworkInfo[] = [];
  
  // Split by "NetworkAgentInfo" sections
  const sections = stdout.split(/NetworkAgentInfo\{/).slice(1);
  
  for (const section of sections) {
    const network: Partial<NetworkInfo> = {};
    
    // Extract network type
    const typeMatch = section.match(/type:\s*(\w+)\[(\w+)\]/);
    if (typeMatch) {
      network.type = typeMatch[1]; // MOBILE
      network.state = typeMatch[2]; // LTE
    }
    
    // Extract interface name
    const ifaceMatch = section.match(/InterfaceName:\s*(\w+)/);
    if (ifaceMatch) network.interfaceName = ifaceMatch[1];
    
    // Extract IP address
    const ipMatch = section.match(/LinkAddresses:\s*\[\s*([^\]]+)\s*\]/);
    if (ipMatch) {
      network.ipAddress = ipMatch[1].trim();
    }
    
    // Extract DNS servers
    const dnsMatch = section.match(/DnsAddresses:\s*\[\s*([^\]]+)\s*\]/);
    if (dnsMatch) {
      network.dnsServers = dnsMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^\//, ''));
    }
    
    // Extract MTU
    const mtuMatch = section.match(/MTU:\s*(\d+)/);
    if (mtuMatch) network.mtu = parseInt(mtuMatch[1]);
    
    // Extract capabilities
    const capsMatch = section.match(/Capabilities:\s*([^\s]+)/);
    if (capsMatch) {
      network.capabilities = capsMatch[1].split('&');
    }
    
    // Extract bandwidth
    const bwMatch = section.match(/LinkUpBandwidth>=(\d+)Kbps LinkDnBandwidth>=(\d+)Kbps/);
    if (bwMatch) {
      network.bandwidth = {
        up: parseInt(bwMatch[1]),
        down: parseInt(bwMatch[2])
      };
    }
    
    networks.push(network as NetworkInfo);
  }
  
  return networks;
}
```

### Option 2: Line-by-Line Parser

```typescript
function parseConnectivityLineByLine(stdout: string): NetworkInfo {
  const lines = stdout.split('\n');
  const network: Partial<NetworkInfo> = {};
  
  for (const line of lines) {
    if (line.includes('InterfaceName:')) {
      network.interfaceName = line.match(/InterfaceName:\s*(\w+)/)?.[1];
    }
    else if (line.includes('LinkAddresses:')) {
      const match = line.match(/LinkAddresses:\s*\[\s*([^\]]+)\s*\]/);
      if (match) network.ipAddress = match[1].trim();
    }
    // ... more conditions
  }
  
  return network as NetworkInfo;
}
```

### Option 3: Multi-Pattern Parser (Most Flexible)

```typescript
interface ParsePattern {
  key: string;
  regex: RegExp;
  transform?: (match: RegExpMatchArray) => any;
}

const CONNECTIVITY_PATTERNS: ParsePattern[] = [
  {
    key: 'interfaceName',
    regex: /InterfaceName:\s*(\w+)/,
    transform: (m) => m[1]
  },
  {
    key: 'ipAddress',
    regex: /LinkAddresses:\s*\[\s*([^\]]+)\s*\]/,
    transform: (m) => m[1].trim()
  },
  {
    key: 'dnsServers',
    regex: /DnsAddresses:\s*\[\s*([^\]]+)\s*\]/,
    transform: (m) => m[1].split(',').map(s => s.trim().replace(/^\//, ''))
  },
  {
    key: 'mtu',
    regex: /MTU:\s*(\d+)/,
    transform: (m) => parseInt(m[1])
  },
  {
    key: 'capabilities',
    regex: /Capabilities:\s*([^\s]+)/,
    transform: (m) => m[1].split('&')
  }
];

function parseWithPatterns(stdout: string, patterns: ParsePattern[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const pattern of patterns) {
    const match = stdout.match(pattern.regex);
    if (match) {
      result[pattern.key] = pattern.transform ? pattern.transform(match) : match[1];
    }
  }
  
  return result;
}
```

## Recommended Implementation for network.ts

```typescript
const NETWORK_CONFIG: NetworkConfig = {
  sections: [
    {
      id: "network_info",
      title: "Network Information",
      commands: [
        {
          id: "connectivity",
          shell: "dumpsys connectivity",
          parser: parseConnectivity, // Use structured parser
        },
      ],
      renderer: (data) => {
        const networks = data["connectivity"] as NetworkInfo[];
        const activeNetwork = networks[0]; // First is usually active
        
        if (!activeNetwork) return {};
        
        return {
          "Network Type": activeNetwork.type || "-",
          "Interface": activeNetwork.interfaceName || "-",
          "IP Address": activeNetwork.ipAddress || "-",
          "DNS Servers": activeNetwork.dnsServers || [],
          "Gateway": activeNetwork.gateway || "-",
          "MTU": activeNetwork.mtu?.toString() || "-",
          "Upload Speed": activeNetwork.bandwidth?.up ? `${activeNetwork.bandwidth.up} Kbps` : "-",
          "Download Speed": activeNetwork.bandwidth?.down ? `${activeNetwork.bandwidth.down} Kbps` : "-",
          "Capabilities": activeNetwork.capabilities || [],
        };
      },
    },
  ],
};
```

## Benefits of Structured Approach

1. ✅ **Type Safety** - Full TypeScript support
2. ✅ **Maintainable** - Easy to add/modify fields
3. ✅ **Testable** - Can unit test parsers
4. ✅ **Reusable** - Parser functions can be shared
5. ✅ **Handles Multiple Networks** - Can parse all active networks
6. ✅ **Error Handling** - Graceful fallbacks
7. ✅ **Documentation** - Clear interfaces

## Next Steps

1. Create parser functions in `tools/parsers/connectivity.ts`
2. Add unit tests for parsers
3. Update network.ts to use structured parsers
4. Add more network sections (WiFi, Telephony, etc)
