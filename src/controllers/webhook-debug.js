/**
 * Debug script for Stripe webhook transaction lookup
 * This file adds enhanced logging with fallback lookup strategies
 * to help diagnose why transactions aren't being found
 */

const mongoose = require('mongoose');
const { MyPtsTransactionModel } = require('../models/my-pts.model');
const { ProfileModel } = require('../models/profile.model');
const { notifyUserOfCompletedTransaction } = require('../services/admin-notification.service');

/**
 * Debug function to find a transaction by multiple methods
 */
async function findTransactionByPaymentIntent(paymentIntentId) {
  console.log('======= WEBHOOK DEBUG HELPER =======');
  console.log('Looking for transaction with payment intent ID:', paymentIntentId);
  
  // Method 1: Direct referenceId lookup
  const transactionByReference = await MyPtsTransactionModel.findOne({
    referenceId: paymentIntentId
  });
  console.log('Found by referenceId:', transactionByReference ? 'YES' : 'NO');
  
  // Method 2: Metadata lookup
  const transactionByMetadata = await MyPtsTransactionModel.findOne({
    'metadata.paymentIntentId': paymentIntentId
  });
  console.log('Found by metadata.paymentIntentId:', transactionByMetadata ? 'YES' : 'NO');
  
  // Log recently created transactions
  const recentTransactions = await MyPtsTransactionModel.find({})
    .sort({ createdAt: -1 })
    .limit(5);
    
  console.log('Recent transactions:');
  recentTransactions.forEach(t => {
    console.log(`- ID: ${t._id}, RefID: ${t.referenceId}, PaymentIntentID: ${t.metadata?.paymentIntentId}, Status: ${t.status}, Created: ${t.createdAt}`);
  });
  
  // Return the transaction if found by either method
  const transaction = transactionByReference || transactionByMetadata;
  
  if (transaction) {
    console.log('FOUND TRANSACTION:', transaction._id.toString());
    // Test notification function
    try {
      console.log('Testing notification function...');
      await notifyUserOfCompletedTransaction(transaction);
      console.log('Notification function succeeded!');
    } catch (error) {
      console.error('Notification function error:', error);
    }
  } else {
    console.log('NO TRANSACTION FOUND FOR PAYMENT INTENT');
  }
  
  console.log('====================================');
  return transaction;
}

// Export the helper function
module.exports = {
  findTransactionByPaymentIntent
};
