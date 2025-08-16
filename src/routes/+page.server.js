export async function load() {
	// Replace with real queries later (DB, JSON, API, etc.)
	const topBrands = [
		{ key: 'dmc', name: 'DMC', count: 507 },
	];

	const exampleSwatches = [
		{ code: '310', name: 'Black', hex: '#000000', brand: 'dmc' },
		{ code: '321', name: 'Red', hex: '#cc1b2b', brand: 'dmc' },
		{ code: 'white', name: 'White', hex: '#f6f7f9', brand: 'anchor' },
		{ code: '703', name: 'Chartreuse', hex: '#6bbf00', brand: 'dmc' },
		{ code: 'blanc', name: 'Blanc', hex: '#ffffff', brand: 'dmc' },
		{ code: '500', name: 'Blue Green', hex: '#0c3b39', brand: 'dmc' }
	];

	return {
		totalColors: 1800,
		totalBrands: topBrands.length,
		totalStashItems: 0,
		topBrands,
		exampleSwatches
	};
}