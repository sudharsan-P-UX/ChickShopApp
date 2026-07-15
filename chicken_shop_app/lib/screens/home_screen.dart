import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import 'billing_screen.dart';
import 'overview_screen.dart';
import 'cart_screen.dart';
import 'pending_orders_screen.dart';
import 'inventory_screen.dart';
import 'customers_screen.dart';
import 'users_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final List<Widget> _screens = [
    const BillingScreen(),
    const OverviewScreen(),
    const CartScreen(),
    const PendingOrdersScreen(),
    const InventoryScreen(),
    const CustomersScreen(),
    const UsersScreen(),
  ];

  String _getScreenTitle(int index) {
    switch (index) {
      case 0:
        return 'Billing & POS';
      case 1:
        return 'Overview';
      case 2:
        return 'View Cart';
      case 3:
        return 'Pending Orders';
      case 4:
        return 'Inventory Control';
      case 5:
        return 'Customer Directory';
      case 6:
        return 'User Management';
      default:
        return 'Chicken Shop POS';
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    
    int index = appState.screenIndex;

    // Check permissions dynamically
    String? menuKey;
    switch (index) {
      case 1: menuKey = 'dashboard'; break;
      case 4: menuKey = 'inventory'; break;
      case 5: menuKey = 'customers'; break;
      case 6: menuKey = 'users'; break;
    }
    if (menuKey != null && !appState.hasPermission(menuKey, 'view')) {
      index = 0; // Fallback to Billing POS
    }

    return Scaffold(
      appBar: AppBar(
        leading: index != 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => appState.setScreenIndex(0),
              )
            : null,
        title: Text(_getScreenTitle(index)),
        elevation: 2,
        actions: [
          if (index == 0) // Billing screen cart icon shortcut
            Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.shopping_cart),
                  onPressed: () => appState.setScreenIndex(2), // go to View Cart
                ),
                if (appState.cartCount > 0)
                  Positioned(
                    right: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        '${appState.cartCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => appState.logout(),
          ),
        ],
      ),
      drawer: Drawer(
        child: Column(
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Colors.deepOrange),
              accountName: Text(
                appState.username.toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              accountEmail: Text(
                'Role: ${appState.userRole.toUpperCase()}',
                style: TextStyle(color: Colors.white.withOpacity(0.8)),
              ),
              currentAccountPicture: const CircleAvatar(
                backgroundColor: Colors.white,
                child: Icon(Icons.person, color: Colors.deepOrange, size: 40),
              ),
            ),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  ExpansionTile(
                    leading: const Icon(Icons.point_of_sale, color: Colors.deepOrange),
                    title: const Text('Register & Billing', style: TextStyle(fontWeight: FontWeight.bold)),
                    initiallyExpanded: true,
                    children: [
                      if (appState.hasPermission('billing', 'view'))
                        ListTile(
                          contentPadding: const EdgeInsets.only(left: 24, right: 16),
                          leading: const Icon(Icons.calculate_outlined),
                          title: const Text('Billing & POS'),
                          selected: index == 0,
                          onTap: () {
                            appState.setScreenIndex(0);
                            Navigator.pop(context);
                          },
                        ),
                      if (appState.hasPermission('billing', 'view'))
                        ListTile(
                          contentPadding: const EdgeInsets.only(left: 24, right: 16),
                          leading: const Icon(Icons.shopping_cart_outlined),
                          title: const Text('View Cart'),
                          selected: index == 2,
                          trailing: appState.cartCount > 0
                              ? Badge(
                                  label: Text('${appState.cartCount}'),
                                  backgroundColor: Colors.red,
                                )
                              : null,
                          onTap: () {
                            appState.setScreenIndex(2);
                            Navigator.pop(context);
                          },
                        ),
                      if (appState.hasPermission('billing', 'view'))
                        ListTile(
                          contentPadding: const EdgeInsets.only(left: 24, right: 16),
                          leading: const Icon(Icons.bookmark_outline),
                          title: const Text('Pending Orders'),
                          selected: index == 3,
                          onTap: () {
                            appState.setScreenIndex(3);
                            Navigator.pop(context);
                          },
                        ),
                    ],
                  ),
                  ExpansionTile(
                    leading: const Icon(Icons.business, color: Colors.deepOrange),
                    title: const Text('Store Management', style: TextStyle(fontWeight: FontWeight.bold)),
                    initiallyExpanded: true,
                    children: [
                      if (appState.hasPermission('dashboard', 'view'))
                        ListTile(
                          contentPadding: const EdgeInsets.only(left: 24, right: 16),
                          leading: const Icon(Icons.dashboard_outlined),
                          title: const Text('Overview'),
                          selected: index == 1,
                          onTap: () {
                            appState.setScreenIndex(1);
                            Navigator.pop(context);
                          },
                        ),
                      if (appState.hasPermission('inventory', 'view'))
                        ListTile(
                          contentPadding: const EdgeInsets.only(left: 24, right: 16),
                          leading: const Icon(Icons.inventory_2_outlined),
                          title: const Text('Inventory Control'),
                          selected: index == 4,
                          onTap: () {
                            appState.setScreenIndex(4);
                            Navigator.pop(context);
                          },
                        ),
                      if (appState.hasPermission('customers', 'view'))
                        ListTile(
                          contentPadding: const EdgeInsets.only(left: 24, right: 16),
                          leading: const Icon(Icons.people_outline),
                          title: const Text('Customer Directory'),
                          selected: index == 5,
                          onTap: () {
                            appState.setScreenIndex(5);
                            Navigator.pop(context);
                          },
                        ),
                      if (appState.hasPermission('users', 'view'))
                        ListTile(
                          contentPadding: const EdgeInsets.only(left: 24, right: 16),
                          leading: const Icon(Icons.admin_panel_settings_outlined),
                          title: const Text('User Management'),
                          selected: index == 6,
                          onTap: () {
                            appState.setScreenIndex(6);
                            Navigator.pop(context);
                          },
                        ),
                    ],
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.logout, color: Colors.red),
                    title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
                    onTap: () {
                      Navigator.pop(context);
                      appState.logout();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: _screens[index],
      ),
    );
  }
}
