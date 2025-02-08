declare module 'geoip-lite' {
    interface GeoIP {
        country: string;
        city: string;
        region: string;
        ll: [number, number];
        range: [number, number];
        query: string;
    }

    function lookup(ip: string): GeoIP | null;

    export { lookup };
}
