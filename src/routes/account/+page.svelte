<script>
  export let data;
  export let form;

  const user = data.user;

  const profileForm = form?.profile;
  const passwordForm = form?.password;

  const initialUsername = profileForm?.values?.username ?? user.username ?? '';
  const initialAvatar = profileForm?.values?.avatarUrl ?? user.avatarUrl ?? '';
</script>

<svelte:head>
  <title>Account – ThreadIndex</title>
</svelte:head>

<section class="account surface">
  <h1>Account</h1>

  <article class="card">
    <h2>Profile</h2>

    <p><strong>Email:</strong> {user.email}</p>
    <p><strong>Username:</strong> {user.username}</p>
    <form method="post" action="?/updateProfile" class="stack">
      <label>
        Username
        <input
          name="username"
          type="text"
          placeholder="optional"
          value={initialUsername}
        />
      </label>

      <label>
        Avatar URL
        <input
          name="avatarUrl"
          type="url"
          placeholder="https://..."
          value={initialAvatar}
        />
      </label>

      {#if profileForm?.error}
        <p class="error">{profileForm.error}</p>
      {/if}
      {#if profileForm?.success}
        <p class="success">{profileForm.success}</p>
      {/if}

      <button type="submit">Save profile</button>
    </form>

    {#if user.avatarUrl}
      <div class="avatar-preview">
        <p>Preview:</p>
        <img src={user.avatarUrl} alt="Avatar preview" />
      </div>
    {/if}
  </article>

  <article class="card">
    <h2>Change password</h2>

    <form method="post" action="?/changePassword" class="stack">
      <label>
        Current password
        <input name="currentPassword" type="password" autocomplete="current-password" />
      </label>

      <label>
        New password
        <input name="newPassword" type="password" autocomplete="new-password" />
      </label>

      <label>
        Confirm new password
        <input name="confirmPassword" type="password" autocomplete="new-password" />
      </label>

      {#if passwordForm?.error}
        <p class="error">{passwordForm.error}</p>
      {/if}
      {#if passwordForm?.success}
        <p class="success">{passwordForm.success}</p>
      {/if}

      <button type="submit">Update password</button>
    </form>
  </article>
</section>

<style>
  .account {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1.5rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .card {
    padding: 1.5rem;
    border-radius: var(--radius, 14px);
    background: var(--surface, #181a1f);
    box-shadow: var(--shadow-1, 0 2px 10px rgba(0,0,0,.25));
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }

  input {
    padding: 0.5rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border, #333);
    background: var(--bg-2, #101318);
    color: var(--text, #f7f1e5);
    font: inherit;
  }

  button {
    align-self: flex-start;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    font: inherit;
    background: var(--brand, #29465b);
    color: #fff;
  }

  .error {
    color: #ff6b6b;
    font-size: 0.85rem;
  }

  .success {
    color: #27c093;
    font-size: 0.85rem;
  }

  .avatar-preview img {
    margin-top: 0.5rem;
    width: 64px;
    height: 64px;
    border-radius: 999px;
    object-fit: cover;
    border: 2px solid var(--border, #333);
  }
</style>
