import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:licenta_app/main.dart';

void main() {
  testWidgets('App should load', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
