import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppState>(context, listen: false).fetchInventory();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    final filteredInventory = state.inventory.where((item) {
      final name = item['item_name'].toString().toLowerCase();
      final query = _searchQuery.toLowerCase().trim();
      return query.isEmpty || name.contains(query);
    }).toList();

    return Column(
      children: [
        // Search Header and Checkout button
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(
                    labelText: 'Search menu items...',
                    prefixIcon: Icon(Icons.search),
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                    });
                  },
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: () => state.setScreenIndex(2), // Switch to Cart Screen
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.shopping_basket),
                label: Text(
                  'Cart (${state.cartCount})',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        // Product Grid
        Expanded(
          child: filteredInventory.isEmpty
              ? const Center(child: Text('No menu items found.'))
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.68,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: filteredInventory.length,
                  itemBuilder: (context, index) {
                    final item = filteredInventory[index];
                    final int itemId = item['id'];
                    final int stock = item['qty'] ?? 0;
                    final double price = double.tryParse(item['price'].toString()) ?? 0.0;
                    final int cartQty = state.cart[itemId] ?? 0;
                    final bool isOutOfStock = stock <= 0;

                    return Card(
                      elevation: 2,
                      clipBehavior: Clip.antiAlias,
                      child: Stack(
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: Container(
                                  color: Colors.grey[200],
                                  child: item['image_url'] != null
                                      ? Image.network(
                                          item['image_url'].startsWith('http')
                                              ? item['image_url']
                                              : '${ApiService.baseUrl.replaceAll('/api', '')}${item['image_url']}',
                                          fit: BoxFit.cover,
                                          errorBuilder: (context, error, stackTrace) => const Icon(
                                            Icons.restaurant,
                                            size: 40,
                                            color: Colors.grey,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.restaurant,
                                          size: 40,
                                          color: Colors.grey,
                                        ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item['item_name'],
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '₹${price.toStringAsFixed(2)}',
                                      style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      isOutOfStock ? 'OUT OF STOCK' : 'Stock: $stock',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: isOutOfStock ? Colors.red : Colors.grey,
                                        fontWeight: isOutOfStock ? FontWeight.bold : FontWeight.normal,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.all(8.0),
                                child: isOutOfStock
                                    ? Container(
                                        width: double.infinity,
                                        height: 32,
                                        decoration: BoxDecoration(
                                          color: Colors.grey[800],
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Center(
                                          child: Text(
                                            state.getLabel('out_of_stock', 'Out of Stock'),
                                            style: const TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      )
                                    : cartQty > 0
                                        ? Container(
                                            width: double.infinity,
                                            height: 32,
                                            decoration: BoxDecoration(
                                              color: Colors.deepOrange,
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                IconButton(
                                                  padding: EdgeInsets.zero,
                                                  constraints: const BoxConstraints(),
                                                  icon: const Icon(Icons.remove, color: Colors.white, size: 18),
                                                  onPressed: () {
                                                    try {
                                                      state.updateCartQty(itemId, -1);
                                                    } catch (e) {
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                                      );
                                                    }
                                                  },
                                                ),
                                                Text(
                                                  '$cartQty',
                                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                                ),
                                                IconButton(
                                                  padding: EdgeInsets.zero,
                                                  constraints: const BoxConstraints(),
                                                  icon: const Icon(Icons.add, color: Colors.white, size: 18),
                                                  onPressed: () {
                                                    try {
                                                      state.updateCartQty(itemId, 1);
                                                    } catch (e) {
                                                      ScaffoldMessenger.of(context).showSnackBar(
                                                        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                                      );
                                                    }
                                                  },
                                                ),
                                              ],
                                            ),
                                          )
                                        : ElevatedButton(
                                            onPressed: () {
                                              try {
                                                state.addToCart(item);
                                              } catch (e) {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                                );
                                              }
                                            },
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.deepOrange,
                                              foregroundColor: Colors.white,
                                              minimumSize: const Size(double.infinity, 32),
                                              padding: EdgeInsets.zero,
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                              elevation: 0,
                                            ),
                                            child: Text(
                                              state.getLabel('add_button', 'Add'),
                                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                            ),
                                          ),
                              ),
                            ],
                          ),
                          // Out of Stock opacity layer
                          if (isOutOfStock)
                            Positioned.fill(
                              child: Container(
                                color: Colors.black.withOpacity(0.4),
                                child: Center(
                                  child: RotationTransition(
                                    turns: const AlwaysStoppedAnimation(-15 / 360),
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      color: Colors.red,
                                      child: Text(
                                        state.getLabel('out_of_stock', 'OUT OF STOCK').toUpperCase(),
                                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
