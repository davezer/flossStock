// src/routes/account/+page.server.js
import { redirect, fail } from '@sveltejs/kit';
import { hashPassword, verifyPassword } from '$lib/server/auth/password.js';

export const load = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    throw redirect(302, '/auth/login?redirectTo=/account');
  }

  return { user };
};

export const actions = {
  // Update username + avatar
  updateProfile: async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    throw redirect(302, '/auth/login?redirectTo=/account');
  }

  const DB = locals.DB;
  if (!DB) {
    return fail(500, {
      profile: { error: 'Auth not initialized.' }
    });
  }

  // Support both { userId } and { id }
  const userId = user.userId || user.id;
  if (!userId) {
    console.error('updateProfile error: no userId on locals.user', user);
    return fail(500, {
      profile: { error: 'User session is missing an id.' }
    });
  }

  const data = await request.formData();
  const username = (data.get('username') || '').toString().trim();
  const avatarUrl = (data.get('avatarUrl') || '').toString().trim();

  if (username.length && username.length < 3) {
    return fail(400, {
      profile: {
        error: 'Username must be at least 3 characters.',
        values: { username, avatarUrl }
      }
    });
  }

  try {
    // If a username was provided, ensure it isn't used by another user
    if (username) {
      const conflict = await DB.prepare(
        `SELECT id FROM user WHERE username = ? AND id != ? LIMIT 1`
      )
        .bind(username, userId)
        .first();

      if (conflict) {
        return fail(400, {
          profile: {
            error: 'That username is already taken.',
            values: { username, avatarUrl }
          }
        });
      }
    }

    // Update this user’s row
    await DB.prepare(
      `UPDATE user
       SET username = ?, avatar_url = ?
       WHERE id = ?`
    )
      .bind(username || null, avatarUrl || null, userId)
      .run();

    return {
      profile: {
        success: 'Profile updated!',
        values: { username, avatarUrl }
      }
    };
  } catch (err) {
    console.error('updateProfile error', err);
    return fail(400, {
      profile: {
        error: 'Failed to update profile. Please try again.',
        values: { username, avatarUrl }
      }
    });
  }
},

  // Change password using your existing hash/verify helpers
  changePassword: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
      throw redirect(302, '/auth/login?redirectTo=/account');
    }

    const DB = locals.DB;
    if (!DB) {
      return fail(500, {
        password: { error: 'Auth not initialized.' }
      });
    }

    const data = await request.formData();
    const currentPassword = (data.get('currentPassword') || '').toString();
    const newPassword = (data.get('newPassword') || '').toString();
    const confirmPassword = (data.get('confirmPassword') || '').toString();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return fail(400, {
        password: {
          error: 'Please fill in all password fields.'
        }
      });
    }

    if (newPassword.length < 8) {
      return fail(400, {
        password: {
          error: 'New password must be at least 8 characters.'
        }
      });
    }

    if (newPassword !== confirmPassword) {
      return fail(400, {
        password: {
          error: 'New password and confirmation do not match.'
        }
      });
    }

    try {
      // 1) Get existing hash for this email
      const row = await DB.prepare(
        `SELECT hashed_password
         FROM user_key
         WHERE id = ?
         LIMIT 1`
      )
        .bind(`email:${user.email}`)
        .first();

      const existingHash = row?.hashed_password;
      if (!existingHash) {
        return fail(400, {
          password: {
            error: 'Current password is incorrect or account is misconfigured.'
          }
        });
      }

      // 2) Verify current password
      const ok = await verifyPassword(currentPassword, existingHash);
      if (!ok) {
        return fail(400, {
          password: {
            error: 'Current password is incorrect.'
          }
        });
      }

      // 3) Write new hash
      const newHash = await hashPassword(newPassword);
      await DB.prepare(
        `UPDATE user_key
         SET hashed_password = ?
         WHERE id = ?`
      )
        .bind(newHash, `email:${user.email}`)
        .run();

      // Optional: here you could invalidate other sessions manually if you track them

      return {
        password: {
          success: 'Password updated!'
        }
      };
    } catch (err) {
      console.error('changePassword error', err);
      return fail(400, {
        password: {
          error: 'Password update failed. Please try again.'
        }
      });
    }
  }
};
