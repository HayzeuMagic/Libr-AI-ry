const borrowService = require('../services/borrowService');

async function createBorrow(req, res) {
  try {
    const { userId, bookId, dueDate } = req.body;

    if (!userId || !bookId) {
      return res.status(400).json({ message: 'userId and bookId are required' });
    }

    const borrowId = await borrowService.createBorrow({ userId, bookId, dueDate });

    return res.status(201).json({
      message: 'Borrow recorded',
      borrowId,
    });
  } catch (err) {
    console.error('Error in createBorrow:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function returnBorrow(req, res) {
  try {
    const { userId, bookId } = req.body;

    if (!userId || !bookId) {
      return res.status(400).json({ message: 'userId and bookId are required' });
    }

    const borrowId = await borrowService.returnBorrow({ userId, bookId });

    if (!borrowId) {
      return res.status(404).json({ message: 'Active borrow not found for this user/book' });
    }

    return res.status(200).json({
      message: 'Return recorded',
      borrowId,
    });
  } catch (err) {
    console.error('Error in returnBorrow:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  createBorrow,
  returnBorrow,
};